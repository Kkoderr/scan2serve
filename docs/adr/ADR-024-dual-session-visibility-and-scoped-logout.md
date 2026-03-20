# ADR-024: Dual Session Visibility and Scoped Logout in Unified Auth

**Date:** 2026-03-20  
**Status:** Accepted  
**Depends on:** ADR-023 (unified `/api/auth/*` with qrToken scope resolution)

## Context
With unified auth routes and separate cookie names, a browser can hold two valid sessions simultaneously:
- business/admin session (`access_token`, `refresh_token`)
- customer session (`qr_customer_access`, `qr_customer_refresh`)

Current web auth context tracks only one active user, which hides the second valid session and makes logout ambiguous.

## Decision
Add explicit dual-session introspection and scoped logout controls while keeping one auth route namespace.
Also allow explicit cross-scope login actions from UI when one scope is already authenticated.

## API Contract
### 1) `GET /api/auth/sessions` (new)
Returns currently valid sessions from access cookies.

Response shape:
- `businessUser`: user summary or `null`
- `customerUser`: user summary or `null`
- `activeScope`: `business | customer` resolved using current qrToken context rules

Rules:
- Validate each access token independently.
- If token invalid/expired/missing, corresponding user is `null`.
- Do not auto-refresh in this endpoint.

### 2) `POST /api/auth/logout` (extended)
Accept optional body `{ scope?: "business" | "customer" | "all" }`.

Behavior:
- `business`: revoke/clear business tokens only.
- `customer`: revoke/clear customer tokens only.
- `all`: revoke/clear both.
- if omitted: keep current scope-based behavior from ADR-023.

## Web Contract
### Auth context
- Store and expose:
  - `businessUser`
  - `customerUser`
  - `activeUser` (for page role behavior)
- Add methods:
  - `logoutBusiness()`
  - `logoutCustomer()`
  - `logoutAll()`

### Header behavior
- If both sessions exist, show both identities.
- Provide clear scoped logout actions:
  - `Logout business`
  - `Logout customer`
- Optionally show `Logout all` where appropriate.
- If only one scope exists, show clear entry action for the other scope login:
  - `Login as business`
  - `Login as customer` (QR-context required as per ADR-023)
- Logging in to one scope must not auto-logout the other scope.

## Consequences
### Pros
- No ambiguity when both sessions are valid.
- Preserves one auth route namespace.
- Better operator UX in mixed-session workflows.

### Trade-offs
- Slightly larger auth context shape.
- Header UI needs compact multi-session rendering.

## Implementation Checklist
1. Add `GET /api/auth/sessions` in API.
2. Extend `POST /api/auth/logout` with optional `scope` body.
3. Update web auth context to hydrate dual sessions.
4. Update header/auth surfaces to render:
   - dual users when both present,
   - scoped logout buttons,
   - scoped login entry for missing scope when one session is active.
5. Add API/web tests for two-session visibility, scoped logout, and cross-scope login entry behavior.

## Acceptance Criteria
1. If both access cookies are valid, UI can display both users.
2. User can explicitly logout either business or customer without affecting the other.
3. If only one scope is active, UI provides login action for the other scope without forcing logout.
4. Existing single-session behavior remains backward compatible.
