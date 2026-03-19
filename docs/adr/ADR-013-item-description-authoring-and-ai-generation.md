# ADR-013: Item Description Authoring and AI Description Generation

**Date:** 2026-03-20  
**Status:** Accepted

## Context
Menu item cards currently do not provide a clear authoring path for item descriptions in the dashboard flow.
Product needs:
- manual description entry per item,
- optional AI-generated description from item context.

The codebase already has a dedicated AI namespace (`/api/ai/*`) and singleton LLM client for menu-related AI tasks.

## Decision
1. Add manual description fields in dashboard menu
- Add description input to item create form.
- Keep description editable in item edit form.
- Display description on item cards when available.

2. Add dedicated AI endpoint for description generation
- Add `POST /api/ai/menu/item-description`.
- Request payload:
  - `businessId` (required),
  - `categoryId` (required),
  - `itemName` (required),
  - `dietaryTags` (optional),
  - `tone` (optional, default neutral).
- Response:
  - `{ description: string }`.

3. Reliability/fallback
- Use singleton LLM client path.
- If LLM unavailable/timeouts/errors, return deterministic templated fallback description derived from category/item/tags.
- Log metadata only (no sensitive full prompt dumps).

4. Web interaction
- Add `Generate AI description` action in item authoring area.
- On success, auto-fill description field for user review before save.
- Preserve current save/update payload behavior.

## Consequences
- Pros:
  - Faster menu authoring with consistent descriptions.
  - Better menu readability and conversion quality.
  - Reuses existing AI architecture.
- Cons:
  - Additional API surface and test complexity.
  - Need guardrails for style/length quality.

## Alternatives Considered
- Client-only description generation (no backend): rejected for key safety and policy consistency.
- Manual-only descriptions: rejected due slower authoring workflow.

## Acceptance Criteria
1. User can manually enter/edit description when creating/updating menu items.
2. User can trigger AI generation and receive a description suggestion.
3. AI failure returns deterministic fallback description without breaking flow.
4. API and web tests cover manual + AI generation paths.
