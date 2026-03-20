# ADR-021: Guardrails for Text and Image Generation

**Date:** 2026-03-20  
**Status:** Accepted

## Context
The API currently supports:
- text generation for menu-item descriptions (`POST /api/ai/menu/item-description`),
- image generation for menu items (`POST /api/business/menu-items/:id/image/generate`).

Both flows validate structural input with Zod, but there is no explicit shared content-safety guardrail layer for user-provided prompts/fields and generated output text.

We need a lightweight, deterministic, backend-side guardrail to block clearly unsafe requests and sanitize generated text before returning it.

## Decision
1. Add a shared AI guardrail service
- Introduce `apps/api/src/services/aiGuardrails.ts` with reusable checks for both text and image paths.
- Keep checks deterministic and local (no external moderation API dependency for this pass).

2. Input guardrails (request side)
- Add denylist-pattern checks for high-risk prompt content (self-harm, sexual minors, explicit violence, hate/harassment, illegal weapon/explosive instructions).
- Add neutral policy around prompt-injection style phrases that try to bypass safeguards.
- Apply to:
  - text generation inputs (`itemName`, optional future text prompt fields),
  - image generation prompt (`prompt` body or fallback generated prompt).
- On violation, return `400` with a specific error code (`AI_PROMPT_UNSAFE`).

3. Output guardrails (response side for text)
- Sanitize generated description by:
  - trimming whitespace,
  - collapsing repeated spaces/newlines,
  - removing markdown/code-fence artifacts,
  - enforcing max length cap (300 chars).
- If sanitized result is empty or still unsafe, use deterministic fallback description.

4. Route integration
- `apps/api/src/routes/ai.ts`
  - enforce input guardrails before model invocation,
  - enforce output guardrails before returning generated description.
- `apps/api/src/routes/business.ts`
  - enforce input guardrails before provider image generation call.

5. Observability
- Log blocked events with structured metadata (route + reason category), without storing full unsafe prompt body.

6. Testing
- Add/extend tests for:
  - blocking unsafe text generation input,
  - blocking unsafe image generation prompt,
  - sanitization/truncation of model text output,
  - fallback when sanitized output is invalid.

## Consequences
- Pros:
  - Safer baseline for both generation surfaces.
  - Shared implementation keeps policy consistent and easier to evolve.
  - No API contract changes for successful requests.
- Cons:
  - Rule-based denylist can produce false positives/negatives.
  - Requires ongoing tuning as prompt patterns evolve.

## Alternatives Considered
- External moderation API for all prompts:
  - deferred to keep latency/dependency footprint low in current phase.
- Route-specific ad-hoc checks only:
  - rejected because it duplicates logic and drifts over time.
