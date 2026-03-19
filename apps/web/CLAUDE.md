# apps/web — Next.js Frontend

## What this is
Next.js 15 App Router frontend. Serves three audiences:
1. **Public** — menu pages (SSR, mobile-first) and order status
2. **Business owners** — dashboard for menu, tables, QR codes, and order management
3. **Admin** — platform management panel

## Commands
```bash
pnpm dev    # start dev server on :3000
pnpm build  # production build
pnpm lint   # run Next.js ESLint
```

## Route Groups
- `src/app/(auth)/` — login, register pages (no auth required)
- `src/app/(public)/` — public menu `/menu/[slug]`, order status `/order/[id]`
- `src/app/dashboard/` — business owner pages (requires business role)
- `src/app/admin/` — admin pages (requires admin role)

## Conventions
- Shared types imported from `@scan2serve/shared`
- API calls go through helper functions in `src/lib/api.ts`
- Auth state managed via React context in `src/lib/auth-context.tsx`
- UI components use shadcn/ui (in `src/components/ui/`)
- Tailwind CSS for styling — mobile-first approach
- Feature-specific components in `src/components/{feature}/`

## Environment
- Copy `.env.example` to `.env.local`
- `NEXT_PUBLIC_API_URL` points to the Express backend

## Updates 2026-03-19
- Added auth context + API client with cookie-based flow and 401 refresh retry.
- Built `/login`, `/register`, `/register/business`, and dashboard placeholder; wrapped app with `AuthProvider`.
- Added `.env.example` for `NEXT_PUBLIC_API_URL`.
- Added Vitest + testing-library + jsdom setup; tests for api fetch retry and auth context login behavior (`tests/`).
- Extended auth context to include business profile state (`businesses`, selected business, profile create/update/list refresh methods) fetched at login/bootstrap.
- Reworked `/dashboard` into Layer 3 status-aware UI with business cards selector, locked overlay for `pending/rejected`, and onboarding CTA when no profile exists.
- Added `/dashboard/onboarding` for business profile create/edit/resubmit flow.
- Added `tests/dashboard.test.tsx` for onboarding-required and pending-lock dashboard states.
- Docker compose diagnostics: web container command is currently invalid after install. `pnpm --filter @scan2serve/web dev -- --hostname 0.0.0.0 --port 3000` resolves to `next dev --port 3000 -- --hostname ...`, and Next interprets `--hostname` as a directory (`Invalid project directory provided`).
- Compose fix applied in `docker-compose.yml`: web command switched to `pnpm --filter @scan2serve/web exec next dev --hostname 0.0.0.0 --port 3000`; verified web boots and reaches ready state in compose.
- Added admin moderation UI at `src/app/admin/page.tsx` (status-filtered list with approve/reject actions) for Layer 3 moderation flow.
- Improved onboarding/dashboard UX for rejection visibility and wrapped onboarding page with `Suspense` for `useSearchParams` build compatibility.
- Removed unsupported Vitest coverage typing from `vitest.config.ts`; `pnpm --filter @scan2serve/web build` and tests now pass.
- Compose healthcheck probe updated to `http://127.0.0.1:3000` to avoid IPv6 localhost false negatives.
- Main-site registration scope changed to business-only: `src/app/(auth)/register/page.tsx` now redirects to `/register/business`.
- Added QR-scoped customer auth pages: `src/app/qr/[qrToken]/page.tsx`, `src/app/qr/login/page.tsx`, and `src/app/qr/register/page.tsx`.
- Extended auth context with QR customer auth helpers that call shared auth endpoints with `qrToken` (`src/lib/auth-context.tsx`).
- `/qr/[qrToken]` now performs server-side QR resolution via API and redirects to `/menu/[slug]?table=...&token=...` on success.
- Added `/menu/[slug]` placeholder page as the QR-resolved public destination until full Layer 6 menu UI is built.
- Runtime note: in docker, server components must use `API_INTERNAL_URL` (container-to-container URL) for API fetches.
- Started Layer 4 UI baseline: added `/dashboard/menu` for category creation, menu item creation, availability toggle, and simple reorder controls wired to business API endpoints.
- Added `tests/menu-page.test.tsx` to cover role guard and initial load behavior for dashboard menu page.

## Updates 2026-03-20
- Added dedicated web health route `src/app/healthz/route.ts` and switched compose probe to `GET /healthz`.
- Upgraded `src/app/dashboard/menu/page.tsx` to include category rename/delete/reorder, menu item edit/delete, and API-backed pagination controls.
- Extended `tests/menu-page.test.tsx` with pagination navigation coverage (`Next` page request assertion).
- Owner-access update: login now redirects by role (`admin` to `/admin`, `business` to `/dashboard`) via `src/app/(auth)/login/page.tsx` and `src/lib/auth-context.tsx`.
- Added owner discoverability on `src/app/page.tsx` and introduced `/owner` alias route (`src/app/owner/page.tsx`) redirecting to admin moderation.
- Owner UX policy tightened: removed explicit admin entry UI from `src/app/page.tsx` and removed `/owner` alias route; admin access is now only via normal login credentials with role-based redirect.
- Expanded Layer 4 menu tests in `tests/menu-page.test.tsx` with item edit/delete interaction coverage and blocked-business behavior assertions.
- Route split update: moved public landing UI from `/` to `src/app/home/page.tsx`; root route (`src/app/page.tsx`) now server-redirects to `/dashboard` (business), `/admin` (admin), or `/home` (unauthenticated/invalid session).
- Root redirect hardening: `src/app/page.tsx` now uses `/api/auth/refresh` as fallback when `/api/auth/me` fails but `refresh_token` exists, so valid sessions still route to role destination.
- Added `tests/root-page.test.ts` to cover root redirect behavior for no-cookie, business session, admin session, and invalid `/api/auth/me` responses.
- Updated login fallback in `src/app/(auth)/login/page.tsx` so non-admin/non-business users are sent to `/home`.
- Updated protected-page unauthenticated guards to redirect to `/home` (instead of `/login`) in `src/app/admin/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/onboarding/page.tsx`, and `src/app/dashboard/menu/page.tsx` so post-logout landing is consistent.
- API client header fix: `src/lib/api.ts` now merges request options before assigning merged headers so `Content-Type: application/json` is preserved even when custom headers (like `x-business-id`) are passed.
- Added regression test in `tests/api.test.ts` to assert outbound requests keep both `Content-Type` and `x-business-id` for POST category creation flows.
- ADR-010 implementation: dashboard menu (`src/app/dashboard/menu/page.tsx`) now shows suggested category chips and category-scoped suggested item chips from API endpoints.
- Selecting a suggested item now auto-fills item name and dietary tag in create form; item cards now visibly display dietary tags as badges.
- Updated `tests/menu-page.test.tsx` to cover suggestion-aware flows and dietary-tag display behavior.
- Switched dashboard item suggestions to dedicated AI endpoint `GET /api/ai/menu/item-suggestions` with `businessId`, `categoryId`, `q`, and `limit` query parameters.
- Added debounced typed-query suggestion fetch in `src/app/dashboard/menu/page.tsx`; old suggestion chips are cleared while request is in-flight so stale suggestions are not shown during search.
- Category change now triggers immediate re-fetch of item suggestions for the newly selected category; added regression coverage in `tests/menu-page.test.tsx`.
