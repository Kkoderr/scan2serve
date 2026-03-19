# ADR-010: AI-Assisted Menu Suggestions for Category and Item Authoring

**Date:** 2026-03-20  
**Status:** Accepted

## Context
Layer 4 menu management is functional, but authoring is fully manual. Business users benefit from lightweight, context-aware assistance while creating categories and menu items.
The requested experience is subtle AI augmentation, not a full autonomous menu generator.

Required product behavior:
- Category create flow should suggest top 5 common categories not already present.
- Menu item create flow should suggest top 5 common items for selected category, excluding already present items.
- Selecting a suggested menu item should auto-fill dietary tags.
- Dietary tags should be visible in menu item display (currently not surfaced clearly).

## Decision
1. Add AI suggestion endpoints under authenticated business scope:
- `GET /api/business/menu-suggestions/categories?businessId=...`
  - returns top 5 category suggestions excluding existing category names.
- `GET /api/business/menu-suggestions/items?businessId=...&categoryId=...`
  - returns top 5 item suggestions relevant to selected category, excluding existing menu item names in that category.
- Response contract includes confidence score and optional recommended dietary tags:
  - `[{ label, confidence, dietaryTags?: DietaryTag[] }]`

2. Suggestion strategy (MVP for subtle assist):
- Start with curated/common seed lists by cuisine/category (rule-based corpus in backend).
- Add optional AI ranking layer (LLM) behind a feature flag:
  - use model inference only to rank/prioritize candidate suggestions, not to produce unrestricted free text.
- Keep deterministic fallback if AI service is unavailable.

3. Dietary tag auto-fill behavior:
- When user clicks a suggested item chip, prefill:
  - item name
  - dietary tags (if available from suggestion payload)
- User can still edit/remove tags before submit.

4. UI behavior in `/dashboard/menu`:
- Show “Suggested categories” while creating category.
- Show “Suggested items” tied to currently selected category.
- Show visible dietary badges/chips per item row/card in list view.
- Keep UI non-blocking: suggestion failures should not block manual creation.

5. Data and safety constraints:
- Do not store user prompts containing PII.
- Log only request metadata, not full suggestion prompt content.
- Apply rate limiting/caching to suggestion endpoints.
- Suggestions must be business-scoped and respect existing auth + approved-business middleware.

## Low-Hassle Enhancements (Recommended)
1. Add one-click “Use suggestion” chips for category names and item names (no modal flow).
2. Cache suggestion responses per business/category for short TTL (e.g., 5-15 minutes) to reduce latency and AI cost.
3. Add “Regenerate suggestions” button with cooldown to avoid accidental spam.
4. Show “Why suggested” tooltip (e.g., “common in this category”) using static explanation text.
5. Add small empty-state prompts in menu page (“Start with suggested categories”) to improve first-use onboarding.

## Consequences
- Pros:
  - Faster menu setup for businesses with minimal UX disruption.
  - Improves quality/consistency of taxonomy and dietary tagging.
  - Maintains manual control while adding assistive intelligence.
- Cons:
  - Additional backend surface area for suggestion endpoints.
  - Requires curation/maintenance of seed datasets and optional AI integration.
  - Added test scope for ranking fallback and exclusion logic.

## Alternatives Considered
- Fully manual only: rejected because setup friction remains high.
- Full autonomous menu generation: rejected for MVP due to trust/control concerns.
- Client-only static suggestions: partially acceptable, but rejected as sole approach because business/category exclusion logic is better enforced server-side.

## Acceptance Criteria (For Implementation Phase)
1. Category suggestions return up to 5 unique names not already present.
2. Item suggestions return up to 5 unique names scoped to selected category and exclude existing items.
3. Selecting an item suggestion auto-populates dietary tags in form.
4. Saved item list visibly displays dietary tags.
5. API + web tests cover suggestion filtering, auto-fill behavior, and graceful fallback when suggestion service fails.
