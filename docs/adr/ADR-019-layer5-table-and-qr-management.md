# ADR-019: Layer 5 Table and QR Management

**Date:** 2026-03-20  
**Status:** Accepted

## Context
Layer 4 menu management is complete and stable. The next dependency layer is table and QR management, which is required before public table-scoped ordering can be fully implemented.

Current gaps:
- `GET /api/business/tables` is still placeholder-only.
- Dashboard has no tables/QR management surface yet.
- QR token rotation exists, but full table lifecycle and QR download/export flows are missing.

We need a single implementation contract for:
- table CRUD-like operations (within MVP scope),
- QR generation/rotation and download exports,
- business access control and response semantics,
- required API/web test coverage.

## Decision
1. Layer 5 scope
- Implement approved-business table management:
  - list tables with pagination/filter basics,
  - bulk create tables with sequential numbering,
  - update table label and active state,
  - add-more tables incrementally without renumbering existing records.
- Keep destructive table delete out of MVP Layer 5 (defer to later ADR) to avoid order/history side effects.
- Keep existing QR rotation endpoint and extend around it with table-first workflows.

2. Access control and business scoping
- All Layer 5 business endpoints require:
  - `requireAuth`,
  - `requireRole("business")`,
  - `requireApprovedBusiness`.
- All operations are constrained to `req.business!.id` ownership.

3. API contract (under `/api/business`)
- `GET /tables?page=1&limit=20&includeInactive=true|false`
  - returns paginated table list with associated QR metadata (`uniqueCode`, `createdAt`, last rotation timestamp when available).
- `POST /tables/bulk`
  - payload: `{ count: number, startFrom?: number, labelPrefix?: string }`.
  - `startFrom` defaults to `(max existing tableNumber + 1)`.
  - creates both `Table` records and corresponding `QrCode` records in one transaction.
- `PATCH /tables/:tableId`
  - payload: `{ label?: string | null, isActive?: boolean }`.
  - supports label edit and active/inactive toggle.
- `POST /tables/:tableId/qr/regenerate`
  - keep existing behavior + response shape compatibility.
- `GET /tables/:tableId/qr/rotations?limit=20`
  - keep existing behavior.
- `GET /tables/:tableId/qr/download?format=png|svg`
  - returns downloadable QR image stream for a single table.
- `POST /tables/qr/download`
  - payload: `{ tableIds?: string[], format: "png" | "svg" }`.
  - returns ZIP export stream containing one QR per selected table (all active tables if `tableIds` omitted).

4. QR payload format
- QR content remains URL-based and table-scoped:
  - `/{menu-route}/{businessSlug}?table={tableNumber}&token={qrToken}` (same runtime semantics as existing QR entry flow).
- Token source of truth remains `qr_codes.unique_code`; rotation history remains in `qr_code_rotations`.

5. Web scope (`/dashboard/tables`)
- Add a dedicated tables page with:
  - bulk create form,
  - table list (number, label, status),
  - label edit and active toggle actions,
  - regenerate QR action,
  - individual QR download,
  - batch export CTA.
- Reuse existing dashboard action/header patterns and archived-view guard behavior.

6. Validation and guardrails
- `count` limited to safe operational bounds (e.g., 1..200 per request).
- unique per-business `tableNumber` enforced; API returns conflict code on collisions.
- rotation/download endpoints return explicit table-not-found/ownership errors.

7. Test requirements
- API tests:
  - table bulk create + sequential numbering logic,
  - table patch (label + active),
  - table listing pagination/filter behavior,
  - QR regenerate and rotation-history continuity,
  - single and batch QR download response contracts,
  - approved-business/ownership guard enforcement.
- Web tests:
  - `/dashboard/tables` role + business-state gating,
  - bulk create/list/update/toggle interactions,
  - regenerate/download/export action wiring.

## Consequences
- Pros:
  - Establishes complete Layer 5 API/UI contracts in one pass.
  - Reuses existing QR token model and rotation audit trail.
  - Keeps customer QR entry behavior consistent for next layers.
- Cons:
  - QR download/export introduces binary response handling and ZIP generation complexity.
  - Bulk create requires careful transactional behavior and conflict handling.

## Alternatives Considered
- Keep Layer 5 to table CRUD only and defer QR download/export to later:
  - rejected because QR distribution is core Layer 5 business value.
- Allow destructive table delete in Layer 5:
  - rejected for MVP due to likely coupling with upcoming order-history semantics.
