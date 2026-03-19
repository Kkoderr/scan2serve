# Project Status

> **How this file works:**
> - **Last Session** — overwritten each session. This is what a new Claude reads first for fast pickup.
> - **Timeline** — append-only log. Never delete or modify past entries. New entries go at the bottom.
> - **Decisions Log** — append-only. All ADRs recorded here.

---

## Last Session

**Date:** 2026-03-19
**What was done:**
- Completed ADR-004 implementation stabilization across API, web, and compose:
  - Added Prisma migration baseline for current schema (`apps/api/prisma/migrations/20260319190000_init/migration.sql`) and lock file.
  - Regenerated Prisma client and fixed baseline API/web type issues blocking builds.
  - Added admin moderation page (`/admin`) and improved dashboard/onboarding rejection visibility UX.
  - Wrapped onboarding page in `Suspense` for `useSearchParams` build compatibility.
- Completed verification:
  - `pnpm --filter @scan2serve/api test` passes.
  - `pnpm --filter @scan2serve/web test` passes.
  - `pnpm --filter @scan2serve/api build` passes.
  - `pnpm --filter @scan2serve/web build` passes.
- Finalized docker-compose reliability:
  - Kept non-interactive pnpm env fixes (`CI=true`, purge confirm disable) and corrected Next.js startup command.
  - Fixed healthcheck IPv6/localhost issue by using `127.0.0.1` for API/web probes.
  - Verified `docker-compose ps` shows `db`, `api`, and `web` all `healthy`.

**What's NOT done yet:**
- Layer 4+ features (menu/table/order/payment flows) are still pending implementation.
- Business gate middleware is only wired to current probe/placeholder routes; keep applying it to new business operation routes as they are added.
- Production cookie/CORS hardening review still pending once deploy targets are fixed.

**Next step:** Start Layer 4 (Menu Management) implementation
1. Define/confirm Layer 4 ADR scope and endpoint contracts (categories, items, ordering, availability).
2. Implement API CRUD for categories/menu items behind `requireApprovedBusiness`.
3. Build dashboard menu-management UI and connect to API.
4. Add API + web tests for menu CRUD and business-approval gate behavior.

**Build progress:**
```
Layer 1:  Foundation          ✅ DONE
Layer 2:  Authentication      ✅ DONE
Layer 3:  Business Onboarding ✅ DONE
Layer 4:  Menu Management     ← NEXT
Layer 5:  Table & QR Codes
Layer 6:  Public Menu & Cart
Layer 7:  Ordering & Payments
Layer 8:  Order Management
Layer 9:  Business Dashboard
Layer 10: Admin Panel
Layer 11: Polish & Deploy
```

---

## Timeline

### 2026-03-19 — Session 2: CLAUDE-aware skill
- Added `skills/claude-context-programmer` to bake CLAUDE.md + STATUS workflows into coding tasks and context handoff.
- Reviewed existing CLAUDE.md guidance; no feature implementation this session.
- Regenerated `agents/openai.yaml` for the skill and installed PyYAML in local `.venv` to support skill scripts.

### 2026-03-19 — Session 3: Auth implementation
- Implemented auth stack with access/refresh httpOnly cookies, refresh rotation, status=1/0 responses, and Prisma `refresh_tokens`.
- Added API auth routes + middleware, response helpers, cookie-parser, env sample.
- Added frontend auth context, API client with refresh retry, login/register/business-register pages, dashboard placeholder, and web env sample.
- Added testing mandate note to root CLAUDE.md: unit + integration/e2e required with new features.
- Added Vitest + supertest/testing-library setups and initial auth tests; ADR-003 recorded in docs/adr.
- Ran `pnpm install --no-frozen-lockfile`; API tests: unit pass, route-level specs skipped in sandbox; Web tests pass.

### 2026-03-19 — Session 4: Layer 3 planning alignment
- Updated STATUS "Last Session" and build progress to reflect Layer 2 auth as complete.
- Drafted ADR-004 (`docs/adr/ADR-004-business-onboarding.md`) to define Business Onboarding architecture and approval gate.
- Set Layer 3 as the implementation next step pending ADR approval.

### 2026-03-19 — Session 5: ADR-004 regeneration
- Regenerated ADR-004 with explicit API contracts, lifecycle transitions, business-feature gating behavior, and required test scope.
- Updated `docs/CLAUDE.md` and root `CLAUDE.md` with ADR refresh context.
- No feature code implemented; waiting for ADR approval before Layer 3 development.

### 2026-03-19 — Session 6: ADR ambiguity checklist
- Regenerated ADR-004 to include 10 explicit ambiguity questions that must be answered in-ADR before approval.
- Updated `docs/CLAUDE.md` and root `CLAUDE.md` notes to reflect the new review gate.
- No feature code implemented; waiting for user answers and ADR acceptance.

### 2026-03-19 — Session 7: Auth route tests unblocked in sandbox
- Reworked `apps/api/tests/authRoutes.test.ts` to run without socket binding by invoking auth route handlers directly from router stack with `node-mocks-http`.
- Removed static skip from auth route suite and adjusted assertions for validation and token mint behavior.
- Verified API test suite in sandbox: `pnpm --filter @scan2serve/api test` passes (2 files, 6 tests).

### 2026-03-19 — Session 8: ADR-004 answers consolidated
- Updated ADR-004 by writing all 10 open-question answers directly in the ADR as concrete implementation decisions.
- Clarified middleware failure contract, admin list default behavior, dashboard lock UX, login-time status fetch policy, and test execution policy.
- Updated `docs/CLAUDE.md` and root `CLAUDE.md`; no feature code implemented yet.

### 2026-03-19 — Session 9: ADR accepted + Layer 3 implementation
- Marked ADR-004 as `Accepted`.
- Added Layer 3 API routes (`business`, `admin`) and business-approval middleware with explicit ADR error codes.
- Updated Prisma schema for multi-business support and rejection history model (`BusinessRejection`).
- Implemented web onboarding/status UX (`/dashboard` lock states + `/dashboard/onboarding` create/edit flow).
- Added onboarding route tests for API and dashboard gating tests for web; API and web test suites pass.

### 2026-03-19 — Session 10: Docker compose diagnostics
- Ran `docker-compose up --build` and captured startup failures.
- Confirmed first blocker: `pnpm install` aborts with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` in `api`/`web` containers without `CI=true`.
- Confirmed second blocker: web compose command forwards invalid args to Next (`Invalid project directory ... /--hostname`).
- Verified API startup succeeds when run with explicit `CI=true` and db push in one-off compose run.

### 2026-03-19 — Session 11: Docker compose fixes applied
- Updated `docker-compose.yml` to make startup non-interactive-safe and corrected web command argument forwarding.
- Added service healthchecks and health-based dependency ordering.
- Verified full stack boot from clean `docker-compose down -v` then `docker-compose up --build`: db/api/web all started successfully.

### 2026-03-14 — Session 1: Project Scaffolding
- Initialized pnpm monorepo with workspace config
- Scaffolded Express + TypeScript backend (`apps/api/`)
- Scaffolded Next.js 15 + Tailwind frontend (`apps/web/`)
- Created shared types package (`packages/shared/`) with all entity types, order flow constants, dietary tags
- Set up Prisma schema with 8 models: users, businesses, categories, menu_items, tables, qr_codes, orders, order_items
- Added ESLint + Prettier at root
- Created CLAUDE.md in root, apps/api, apps/web, packages/shared
- Verified API health endpoint working
- Initial commit `3ac7e00` on `main`

### 2026-03-19 — Session 12: Full stabilization + compose healthcheck fix
- Added migration baseline files for current Prisma schema and regenerated Prisma client.
- Fixed baseline build blockers (API async handler typing, Prisma client import typing, and web Vitest config typing), then verified both app builds pass.
- Added admin moderation page and improved onboarding/dashboard status UX consistency.
- Diagnosed compose false-unhealthy web status as IPv6 localhost probe failure (`::1`) and switched API/web healthcheck URLs to `127.0.0.1`.
- Reverified compose stack health via `docker-compose ps`: `db`, `api`, and `web` all healthy.

---

## Decisions Log

| # | Decision | Why | Date |
|---|----------|-----|------|
| ADR-001 | pnpm workspaces (not npm/Nx) | Strict dep isolation without overhead; Nx overkill for 2 apps at MVP | 2026-03-14 |
| ADR-003 | Testing strategy (Vitest, supertest, testing-library; status field enforcement) | Establish unified test stack and coverage expectations across API & web | 2026-03-19 |
| ADR-004 | Business onboarding flow and admin approval gate | Define Layer 3 boundaries before implementation (business profile lifecycle + admin moderation) | 2026-03-19 |

---

## Key Commands

```bash
pnpm install              # install all deps
pnpm dev                  # start both frontend (:3000) and backend (:4000)
pnpm dev:api              # start backend only
pnpm dev:web              # start frontend only
pnpm --filter @scan2serve/api db:migrate   # run Prisma migrations
pnpm --filter @scan2serve/api db:seed      # seed admin user
```
