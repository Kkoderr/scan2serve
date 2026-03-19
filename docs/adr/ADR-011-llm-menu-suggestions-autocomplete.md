# ADR-011: LLM-Driven Menu Suggestions and Typed-Text Autocomplete

**Date:** 2026-03-20  
**Status:** Accepted

## Context
ADR-010 introduced deterministic curated suggestions for categories/items and dietary-tag autofill. That baseline works, but suggestion quality feels static.
Product now requires LLM-backed suggestions that adapt to existing business menu context and in-progress user input.

Required behavior:
- For menu items: suggest top 5 favorable items for a category based on already present items.
- If no item context exists in the category, return top 5 common items for that category.
- Support autocomplete and live suggestion updates based on text typed so far.

## Decision
1. Add LLM integration in API suggestion service
- Introduce an LLM client wrapper in API service layer (`apps/api/src/services/llmMenuSuggestions.ts`).
- LLM client/model instance must be singleton per API process (lazy-init once, reused across all requests).
- Use environment-configurable provider credentials (e.g., `OPENAI_API_KEY`) and model name (`LLM_MENU_MODEL`).
- Keep deterministic ADR-010 suggestions as fallback when LLM is unavailable/timeouts/errors.

2. Evolve menu-suggestions item endpoint contract
- Use dedicated AI route namespace: `GET /api/ai/menu/item-suggestions`.
- Add optional query params:
  - `businessId` (required)
  - `categoryId` (required)
  - `q` (optional typed prefix or partial phrase from item input)
  - `limit` (optional, default 5, max 10)
- Response remains:
  - `[{ label, confidence, dietaryTags[] }]`
- Filtering guarantees:
  - Exclude existing items in selected category.
  - If `q` provided, prioritize prefix/semantic matches to typed text.

3. Prompting and ranking policy
- Input context to LLM:
  - category name
  - existing item names in category
  - optional user-typed text (`q`)
- Output constrained to JSON schema and max N suggestions.
- Post-process server-side:
  - dedupe labels case-insensitively
  - remove existing items
  - clamp to top 5
  - map/sanitize dietary tags against shared enum

4. Web autocomplete behavior
- Dashboard menu page calls suggestion endpoint with debounce while typing item name.
- Chips/list update dynamically from typed text.
- Selecting suggestion keeps existing ADR-010 behavior:
  - fill item name
  - auto-fill dietary tags

5. Reliability and cost controls
- Request timeout (e.g., 2-3s) on LLM call.
- In-memory short TTL cache keyed by (`businessId`, `categoryId`, `q`).
- Graceful fallback to deterministic suggestions when LLM unavailable.
- Log only metadata (timing/status), not raw prompts with business-sensitive details.

## Consequences
- Pros:
  - More relevant suggestions aligned with business context and live typing.
  - Better authoring speed than static lists.
  - Preserves deterministic fallback resilience.
- Cons:
  - External dependency + API key management.
  - Token/cost and latency considerations.
  - Additional testing complexity for fallback and typed-query behavior.

## Alternatives Considered
- Keep deterministic-only ADR-010 approach: rejected due perceived static relevance.
- Client-side LLM calls directly from web: rejected for key safety and consistent policy enforcement.
- Hybrid search-only (no LLM): deferred; fallback remains deterministic and could be improved later.

## Acceptance Criteria
1. Item suggestions are context-aware to existing category items and limited to top 5.
2. With no existing items, endpoint returns category-common top 5.
3. With typed input (`q`), suggestions adapt to current text.
4. Existing items are never returned in suggestions.
5. LLM failure/timeouts fall back to deterministic suggestions without breaking UI.
6. API + web tests cover typed-query behavior, exclusion logic, and fallback path.
