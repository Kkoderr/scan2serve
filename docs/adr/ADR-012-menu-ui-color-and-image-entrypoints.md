# ADR-012: Menu UI Color Refresh and Item Image Entry Points

**Date:** 2026-03-20  
**Status:** Accepted

## Context
Dashboard menu management currently works functionally, but category cards feel visually unusual and item cards do not provide a clear image slot.
Product needs:
- improved category card aesthetics with color accents,
- an image placeholder per menu item,
- explicit user entry points to either upload an image or generate one with AI.

Current Layer 4 state (ADR-007) does not include a full upload pipeline yet (URL-only in API contracts), so this change should avoid introducing backend storage complexity in this pass.

## Decision
1. Category card visual refresh (web-only)
- Redesign category cards in `apps/web/src/app/dashboard/menu/page.tsx` with intentional color accents and better selected-state contrast.
- Keep current interactions and data behavior unchanged.

2. Item image placeholder with action entry points (web-first)
- Add an image placeholder region on each menu item card:
  - if `item.imageUrl` exists, render image preview,
  - otherwise render styled placeholder.
- Add two CTA controls near placeholder:
  - `Upload` (opens file chooser UI hook),
  - `Generate AI` (opens generation action hook).
- In this ADR pass, CTAs are UI entry points only and must not claim persistence if backend endpoint is not yet implemented.

3. Incremental backend integration boundary
- Do not add file-storage backend in this pass.
- If `Upload`/`Generate AI` actions need persistence, follow-up ADR will define:
  - upload API contract,
  - storage strategy (local/S3),
  - image-generation provider flow and moderation constraints.

4. Accessibility + testing
- All icon/CTA controls require accessible labels.
- Extend web tests to verify:
  - category cards render updated visual classes (non-functional sanity),
  - placeholder presence when image is absent,
  - image preview rendering when `imageUrl` exists,
  - upload/generate CTA presence and enabled/disabled state.

## Consequences
- Pros:
  - Cleaner and more intentional dashboard look.
  - Clear mental model for item imagery during menu authoring.
  - Enables gradual rollout without blocking on backend storage/generation.
- Cons:
  - Upload/generate CTAs may be non-persistent until backend follow-up lands.
  - Additional UI complexity in item cards.

## Alternatives Considered
- Defer all image UI until backend upload pipeline exists: rejected because authoring UX remains incomplete.
- Add full upload/generation backend now: rejected for scope/risk relative to requested UI polish.

## Acceptance Criteria
1. Category cards use improved color styling and selected state is visually clear.
2. Each item card shows either image preview (`imageUrl`) or placeholder.
3. Each item card exposes visible `Upload` and `Generate AI` actions.
4. Web tests cover placeholder/image rendering and CTA presence.
