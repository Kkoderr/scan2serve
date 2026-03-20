# ADR-017: Dashboard Logo Cards + Business Archive Lifecycle

**Date:** 2026-03-20  
**Status:** Accepted

## Context
Requested dashboard improvements:
1. use business logo images in dashboard business cards,
2. add delete option for businesses with confirmation,
3. replace immediate delete with archive flow where archived businesses are permanently deleted after 30 days.

Current constraints:
- `Business.status` supports `pending|approved|rejected` only.
- Dashboard business cards currently render text-only summary.
- There is no business archive state or archive-retention cleanup job.
- Menu image lifecycle already uses deferred S3 cleanup queue (`deleted_asset_cleanups`).

## Decision
1. Business lifecycle extension
- Add `archived` to business status enum.
- Add `archivedAt` timestamp on `Business` (`archived_at` nullable).
- Archiving is owner-initiated from dashboard.
- Archived businesses are treated as inactive/non-operational in business flows.

2. Dashboard UX changes
- Business cards display logo image when present, with graceful placeholder when absent.
- Add `Archive business` action for selected business.
- Archive action requires explicit confirmation dialog:
  - explain 30-day retention + permanent deletion behavior,
  - require explicit confirm action before API call.
- Archived businesses are visually labeled and excluded from active operation actions.
- Archived businesses are hidden by default in dashboard list, with explicit user toggle to show them.

3. API contract for archive action
- Add endpoint: `PATCH /api/business/profile/archive`.
- Ownership enforced (`req.user.id` must own the business).
- Request includes `businessId`.
- Server sets:
  - `status = archived`,
  - `archived_at = now()`.
- Endpoint is idempotent for already archived entities.

4. Retention and permanent deletion
- Add scheduled archive cleanup worker in API:
  - scans archived businesses where `archived_at <= now() - 30 days`,
  - hard-deletes those businesses.
- Cleanup runs via env-configurable interval (default daily).
- During retention window, user may restore archived business from dashboard.
- Deletion path enqueues known S3 object paths for cleanup where available:
  - menu item `image_path` values for that business,
  - business logo path if stored in path form (best-effort).
- On permanent delete, write a dedicated audit record containing core business metadata and deletion timestamp.

5. Compatibility and guards
- Existing flows that depend on approved status continue to work unchanged for active businesses.
- Archived businesses do not pass `requireApprovedBusiness` checks.
- Existing users/businesses migrate safely with default non-archived state.

6. Testing requirements
- API tests:
  - archive endpoint ownership + status transitions,
  - archived business operational blocking behavior,
  - archive cleanup worker deletes only eligible aged archived businesses.
- Web tests:
  - dashboard business cards render logo/placeholder consistently,
  - archive confirmation flow calls API only after explicit confirmation,
  - archived status display and active-controls behavior.

## Consequences
- Pros:
  - safer deletion semantics for business owners,
  - recoverability window before destructive delete,
  - cleaner dashboard visual identity via logos.
- Cons:
  - additional lifecycle state complexity,
  - scheduled cleanup maintenance burden,
  - potential edge handling for logo object path extraction from URL-based legacy records.

## Alternatives Considered
- Immediate hard delete with one confirmation: rejected due higher accidental loss risk.
- Keep only soft-archive forever without cleanup: rejected due data/storage accumulation.
- Client-only archive UX without server state: rejected; lifecycle must be server-authoritative.

## Acceptance Criteria
1. Dashboard business cards show logo image where available.
2. Business archive action requires confirmation and does not run on accidental click.
3. Archived businesses are marked inactive and blocked from normal business operations.
4. Archived businesses older than 30 days are permanently deleted by scheduled worker.
5. API/web tests cover archive flow, retention cleanup, and dashboard behavior.
