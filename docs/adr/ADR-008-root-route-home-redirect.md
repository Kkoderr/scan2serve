# ADR-008: Root Route Redirect and `/home` Landing Split

**Date:** 2026-03-20  
**Status:** Accepted

## Context
The current public landing page is served at `/`. We need root routing behavior that:
- sends logged-in users directly to their app area,
- keeps an explicit public landing route for unauthenticated traffic,
- avoids duplicate landing implementations.

## Decision
1. Route split
- Move the existing public landing UI from `/` to `/home`.
- Keep `/` as a redirect-only entrypoint.

2. Redirect behavior at `/`
- If no business auth cookies are present, redirect to `/home`.
- If auth cookies are present, resolve user role via `GET /api/auth/me` and redirect:
  - `admin` -> `/admin`
  - `business` -> `/dashboard`
  - any other role or invalid response -> `/home`
- If `/api/auth/me` fails but `refresh_token` exists, attempt `POST /api/auth/refresh` and route by returned role payload before falling back to `/home`.

3. Login fallback
- Update non-admin/non-business login fallback redirect to `/home` instead of `/`.

4. Test coverage
- Add web tests for root redirect behavior:
  - no cookies -> `/home`
  - business session -> `/dashboard`
  - admin session -> `/admin`
  - invalid `/api/auth/me` response -> `/home`

## Consequences
- Pros:
  - Root URL becomes deterministic app-entry logic.
  - Public landing is preserved at a stable explicit route (`/home`).
  - Reduces confusion for authenticated users who visit `/`.
- Cons:
  - Root route now depends on a server-side auth lookup.
  - Additional route (`/home`) must be included in future navigation checks.

## Alternatives Considered
- Keep landing UI at `/` and redirect from `/home`: rejected because requirement is redirecting from `/`.
- Client-side redirect at `/` with auth context only: rejected in favor of server-side redirect behavior at request time.
