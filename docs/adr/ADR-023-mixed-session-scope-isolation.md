# ADR-023: Unified Auth Routes with QR-Token Scope Resolution

**Date:** 2026-03-20  
**Status:** Accepted  
**Refines:** ADR-006 session-boundary implementation details (keeps policy intent, changes route mechanics).

## Context
The current platform supports both business/admin auth and QR-customer auth, and both may exist in the same browser session.  
The implementation challenge is preventing identity bleed (business session leaking into customer surfaces) while avoiding route fragmentation.

The previous ADR-023 draft proposed splitting customer auth into `/api/qr-auth/*`. This is not desired for this codebase.

## Decision
Keep a single auth namespace (`/api/auth/*`) and resolve auth scope by QR token validity:

- If a valid `qrToken` is present on the request, treat it as **customer-scope auth**.
- If no valid `qrToken` is present, treat it as **business-scope auth**.

No separate customer auth route namespace will be introduced.

## Scope Resolution Contract
### Source of truth
Scope is inferred from request context in this order:
1. Explicit `qrToken` provided by client (body/query/header as endpoint contract allows).
2. If provided token validates against active QR/business/table constraints, request scope = `customer`.
3. Otherwise request scope = `business`.

### Scope guardrail
- Invalid/tampered `qrToken` must be rejected for customer-intent auth attempts (`403 CUSTOMER_AUTH_QR_ONLY` style contract remains aligned with ADR-006).
- Customer flows must not silently downgrade to business auth when an invalid `qrToken` was explicitly supplied.

## Endpoint Contract (Single Namespace)
Retain:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

All endpoints are scope-aware via the QR-token resolution rule above.

## Cookie Ownership
Cookie sets remain separate:

- Business/admin:
  - `access_token`
  - `refresh_token`
- QR customer:
  - `qr_customer_access`
  - `qr_customer_refresh`

Rules:
1. Business-scope resolution reads/writes only business cookies.
2. Customer-scope resolution reads/writes only customer cookies.
3. Foreign-scope cookies are ignored.

## Refresh / Me / Logout Semantics Under Single Namespace
Because routes are unified, these endpoints must remain deterministic:

- `POST /api/auth/refresh`
  - With valid `qrToken`: operate on `qr_customer_refresh`.
  - Without valid `qrToken`: operate on `refresh_token`.
- `GET /api/auth/me`
  - With valid `qrToken`: resolve customer identity from customer access cookie.
  - Without valid `qrToken`: resolve business/admin identity from business access cookie.
- `POST /api/auth/logout`
  - With valid `qrToken`: clear customer cookies only.
  - Without valid `qrToken`: clear business cookies only.

This keeps one endpoint surface while preserving session isolation.

## Frontend Contract
- QR and menu customer surfaces must always call `/api/auth/*` with the QR token context.
- Dashboard/admin/business surfaces must call `/api/auth/*` without QR token context.
- Shared UI shell/header must render identity from route-appropriate auth state and never merge business/customer profile display.

## Observability
Structured auth logs must include:
- `auth.scope.resolved` (`scope=customer|business`, `qrTokenPresent`, `qrTokenValid`)
- `auth.scope.invalid_qr_token`
- `auth.scope.cookie_foreign_present`

This is required to debug mixed-session behavior in one namespace.

## Consequences
### Pros
- Keeps API surface simple (single auth namespace).
- Preserves existing route contracts and reduces migration churn.
- Supports concurrent business + customer sessions with explicit scope resolution.

### Trade-offs
- Unified endpoints require stricter internal branching discipline.
- Every customer auth call must reliably include QR token context.
- Slightly higher complexity in shared middleware/helpers versus hard namespace split.

## Alternatives Considered
1. Split customer auth into `/api/qr-auth/*`.
- Rejected by product direction for this project.

2. Force one active scope per browser and clear opposite-scope cookies.
- Rejected due to poor UX for owners who also test customer flows.

## Implementation Checklist
1. Refactor auth handlers to centralize scope resolution by QR token validity.
2. Ensure refresh/me/logout use the same deterministic scope resolver.
3. Remove/avoid logic that treats mixed cookies as an automatic fatal condition when scope is otherwise clear.
4. Add tests for:
   - valid-qr customer login/refresh/me/logout,
   - business login/refresh/me/logout without qrToken,
   - invalid qrToken rejection (no silent downgrade),
   - concurrent cookie coexistence with correct scope selection.

## Acceptance Criteria
1. Single `/api/auth/*` namespace remains the only auth API surface.
2. Valid `qrToken` requests authenticate as customer; non-QR requests authenticate as business/admin.
3. Customer pages never render business identity when both cookie sets are present.
4. Business pages never depend on customer identity state.
5. Mixed-session scenarios are covered by automated API and web tests.
