# ADR-004: Business Onboarding and Admin Approval Flow

**Date:** 2026-03-19  
**Status:** Accepted  

## Context
Layer 2 authentication is complete. Business users can register and log in, but there is no enforced onboarding lifecycle before they access business operations (menu, tables, orders). We need a clear Layer 3 contract that:
- captures business profile data after auth,
- supports admin moderation (approve/reject),
- blocks operational business features until approval,
- remains consistent with existing API response format and role middleware.

## Decision
1. Lifecycle model
- A `business` role user may create and manage multiple business profiles in MVP.
- Profile status is the existing enum: `pending`, `approved`, `rejected`.
- Initial status on profile creation is always `pending`.
- Rejected profiles can be edited and resubmitted (status set back to `pending`).
- For already approved businesses, profile edit requests should not remove operational access for the currently approved profile while review is pending.

2. Backend API scope (Layer 3)
- Business self-service endpoints:
  - `POST /api/business/profile` create own business profile.
  - `GET /api/business/profile` fetch own business profile + status for current business context.
  - `PATCH /api/business/profile` update own profile; if previously rejected, transition to `pending`.
- Admin moderation endpoints:
  - `GET /api/admin/businesses?status=pending|approved|rejected`
  - `PATCH /api/admin/businesses/:id/approve`
  - `PATCH /api/admin/businesses/:id/reject`
- Rejection payload supports optional reason in MVP; full rejection history is persisted.

3. Access control and gating
- Keep `requireAuth` + `requireRole` as primary auth guard.
- Add business-approval guard middleware for operational business routes (menu/tables/orders), requiring `status=approved`.
- Behavior by state:
  - No profile: block operational routes; prompt onboarding.
  - `pending`: block operational routes; show pending status view.
  - `rejected`: block operational routes; show rejection reason + edit/resubmit path.
  - `approved`: allow operational routes.

4. Frontend behavior
- Business user post-login routing:
  - no profile -> onboarding form,
  - pending/rejected -> onboarding status screen,
  - approved -> dashboard.
- Dashboard shell remains accessible for status messaging with a full-page blur/lock overlay and status banner for blocked states.
- Auth context should include business onboarding status fetch/refresh for route decisions.
- Onboarding status fetch runs at auth bootstrap/login only (no periodic route/focus polling in MVP).

5. Contract and quality
- API response contract stays `{ status: 1|0, data?, error? }`.
- Required tests:
  - API integration tests for create/get/update profile and approve/reject transitions.
  - API authorization tests for business route gating by status.
  - Web tests for route/status guard transitions.

## Open Questions Resolution (Answered)
1. `POST /api/business/profile` idempotency:
- `POST` is create-only. If a profile for the same identity/business context already exists, return conflict (`409`, `status: 0`, `BUSINESS_PROFILE_EXISTS`).

2. `PATCH /api/business/profile` for `approved` businesses:
- Edit requests are reviewable, but currently approved business access remains usable.
- If an edit request is rejected, keep the previously approved profile as active and notify the business user.

3. Rejection reason persistence:
- Rejection reason remains optional; store `null` when no reason is provided.
- Persist full rejection history in DB; frontend surfaces latest 3 rejection entries.

4. `GET /api/admin/businesses` default filtering:
- When `status` query is omitted, return all statuses.

5. Admin transition constraints:
- `approve`/`reject` actions are allowed only from `pending` state.

6. Business-approval middleware failure contract:
- Response shape stays `{ status: 0, error: { code, message } }`.
- `no profile` -> `403` + `BUSINESS_PROFILE_REQUIRED`.
- `pending` -> `403` + `BUSINESS_PENDING_APPROVAL`.
- `rejected` -> `403` + `BUSINESS_REJECTED` (include latest rejection reason when available).

7. Frontend dashboard gating UX:
- Keep dashboard shell accessible.
- For blocked states, render dashboard with locked/blurred content and a status banner at top.

8. Frontend onboarding status refresh strategy:
- Fetch onboarding status during auth bootstrap/login only.
- Do not auto-refresh on route change/window focus in MVP.

9. One-business-per-user enforcement:
- Remove one-business-per-user restriction.
- Do not enforce uniqueness on `businesses.user_id` at the application layer.
- Add/plan a business selector page showing user-owned businesses as cards; cross-business access hardening can be expanded in a follow-up security-focused ADR.

10. Test execution policy:
- Route-level and integration suites should run in current sandbox and CI (no static skip strategy).


## Alternatives Considered
- Auto-approve all businesses at registration: rejected because it removes moderation control needed by product requirements.
- Separate onboarding table instead of `businesses.status`: rejected for MVP because existing schema already models lifecycle.
- Hard-block all dashboard routes (including status page): rejected because users still need visibility into pending/rejected state.

## Consequences
- Pros:
  - Establishes explicit Layer 3 boundary before Layer 4+ features.
  - Reduces risk of unapproved businesses accessing ordering infrastructure.
  - Keeps schema and middleware changes incremental.
- Cons:
  - Adds cross-cutting checks in backend middleware and frontend routing.
  - Requires careful UX handling for rejected/resubmission states.
- Follow-up:
  - Consider mandatory rejection reason after MVP if support volume requires clearer feedback.
  - Finalize concrete persistence design for approved-profile edit reviews (active profile vs pending changes model) during Layer 3 implementation.
  - Define business selector UX and cross-business authorization hardening details in a dedicated follow-up ADR.
