# ADR-007: Layer 4 Menu Management (Categories + Menu Items)

**Date:** 2026-03-19  
**Status:** Accepted

## Context
Layer 3 onboarding and business approval gating are in place. Businesses need core menu management before table ordering can be completed. We need a clear Layer 4 contract that defines:
- category CRUD,
- menu-item CRUD,
- ordering/reordering semantics,
- availability toggling,
- access control under approved-business policy,
- test coverage expectations.

## Decision
1. Scope (Layer 4)
- Implement authenticated business-side management for:
  - Categories: create, list, rename, delete, reorder.
  - Menu items: create, list, update, delete, reorder.
  - Availability toggling (`isAvailable`) for menu items.
- Keep image upload/storage integration minimal in this layer (URL field support only); full upload pipeline can remain a follow-up.

2. Access control
- All Layer 4 business menu endpoints require:
  - `requireAuth`,
  - `requireRole("business")`,
  - `requireApprovedBusiness`.
- Any non-approved business state remains blocked with existing ADR-004 error contract.

3. API contract
- Category endpoints (under `/api/business`):
  - `GET /categories` -> list categories for selected business ordered by `sortOrder`.
  - `POST /categories` -> create category (`name`).
  - `PATCH /categories/:id` -> rename/update `sortOrder`.
  - `DELETE /categories/:id` -> delete category.
  - `POST /categories/reorder` -> batch reorder by ordered IDs.
- Menu item endpoints:
  - `GET /menu-items` -> list menu items for selected business ordered by `sortOrder`.
  - `POST /menu-items` -> create item.
  - `PATCH /menu-items/:id` -> update item fields.
  - `DELETE /menu-items/:id` -> delete item.
  - `POST /menu-items/reorder` -> batch reorder by ordered IDs.
  - `PATCH /menu-items/:id/availability` -> toggle `isAvailable`.
- Response envelope remains `{ status: 1|0, data?, error? }`.

4. Data semantics
- Category `name` unique per business.
- Item `name` does not need uniqueness for MVP.
- Reorder requests are authoritative lists; server rewrites contiguous `sortOrder` values (0..N-1).
- Deleting a category with linked menu items is blocked by default with conflict response (`409 CATEGORY_NOT_EMPTY`) for safer MVP behavior.

5. Web behavior (`/dashboard/menu`)
- Business UI includes:
  - Category list and CRUD controls.
  - Item list per selected category and CRUD controls.
  - Availability toggle in item list.
  - Reorder controls (basic up/down in MVP; drag-drop optional follow-up).
- If business is blocked (`pending`/`rejected`), dashboard gating behavior from Layer 3 remains authoritative.

6. Quality and tests
- Required API tests:
  - category CRUD + reorder,
  - menu-item CRUD + reorder + availability toggle,
  - approved-business gating on all Layer 4 endpoints.
- Required web tests:
  - menu page load states,
  - create/update/delete flows for categories/items,
  - availability toggle and reorder interactions.

## Open Questions (To Resolve Before Acceptance)
1. Category deletion behavior:
- keep strict block when category has items (`409 CATEGORY_NOT_EMPTY`) or cascade delete items?
[Give a warning dialog box to confirm before deleting the category ]

2. Reorder payload format:
- ordered ID list only, or `{id, sortOrder}` tuples?
[{id, sortOrder}]

3. Item price validation:
- integer cents or decimal string input on API boundary?
[decimal string]

4. Dietary tags:
- free-text tags for MVP, or constrained enum from shared constants?
[yupp create a particular constrained enum dont want any injection threats here]

5. Availability bulk action:
- include bulk endpoint in Layer 4 or defer to later layer?
[later]

6. Category/item listing:
- single joined endpoint for dashboard bootstrap or separate endpoints?
[separate endpoints]
7. Pagination:
- required now for menu items or defer until scale requires it?
[implement pagination]
8. Image handling:
- keep URL-only input in Layer 4 and defer upload API to later layer?
[A: URL-only in Layer 4; upload/storage service deferred]
9. Category reorder side effects:
- should item ordering reset/adjust when categories reorder? (recommended: no)
[no]
10. Empty-state defaults:
- should first category be auto-created on first menu item creation, or require explicit category creation first?
[by default keep the state empty]

## Resolved Decisions (Implementation-Ready)
- Category deletion: API blocks deletion when linked menu items exist (`409 CATEGORY_NOT_EMPTY`); UI shows warning dialog before delete action.
- Reorder payload format: use `{ id, sortOrder }` tuples.
- Price input contract: decimal string at API boundary (e.g. `"199.50"`), validated to max 2 fractional digits.
- Dietary tags: constrained enum values from shared constants (no free-text tags in Layer 4).
- Availability bulk action: deferred to later layer (single-item toggle only in Layer 4).
- Category/item listing: separate endpoints for dashboard data fetch.
- Pagination: include menu-item pagination in Layer 4.
- Image handling: URL-only in Layer 4; upload/storage service integration deferred.
- Category reorder side effects: no item-order reset/adjust on category reorder.
- Empty-state behavior: no auto category creation; explicit category creation required.
## Consequences
- Pros:
  - Establishes clear Layer 4 boundary and contracts before coding.
  - Keeps business gating and response contracts consistent with prior ADRs.
  - Reduces implementation ambiguity for API/web/test work.
- Cons:
  - Additional endpoint surface and test scope.
  - Reorder semantics and category deletion policy require upfront clarity.

## Alternatives Considered
- Single monolithic `/menu` write endpoint for all operations: rejected for MVP maintainability and test clarity.
- Delay reorder support: rejected because sort behavior quickly becomes a UX issue once items grow.
