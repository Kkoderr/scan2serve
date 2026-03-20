# ADR-022: Gemini-Only Runtime for Menu Image Generation

**Date:** 2026-03-20  
**Status:** Accepted

## Context
`generateMenuItemImage()` currently includes legacy provider-switch logic and Nano-Banana-specific environment keys.

Product direction is now to run menu image generation exclusively through Gemini APIs. Keeping dormant provider-switch branches creates unnecessary complexity and stale configuration surface.

## Decision
1. Make API image generation Gemini-only.
- `apps/api/src/services/aiImageProvider.ts` now always executes Gemini REST `generateContent` flow.
- Remove Nano-Banana request/response code paths.

2. Remove provider-switch requirement from runtime config.
- Remove `AI_IMAGE_PROVIDER` dependency in image generation service.
- Remove `NANOBANANA_*` keys from API env example and docker-compose API env.

3. Preserve existing route contracts.
- `POST /api/business/menu-items/:id/image/generate` behavior and error semantics remain unchanged.
- On Gemini unavailability/timeout/invalid payload, service still returns `null` and route returns `AI_IMAGE_GENERATION_FAILED`.

4. Keep existing Gemini config keys.
- `GEMINI_API_KEY`
- `GEMINI_API_URL`
- `GEMINI_IMAGE_MODEL`
- `AI_IMAGE_TIMEOUT_MS`

5. Testing updates.
- Update provider tests to assert Gemini behavior as the only runtime path.

## Consequences
- Pros:
  - Simpler service logic and lower maintenance overhead.
  - Single configuration path for all menu image generation.
- Cons:
  - No built-in fallback provider path without a new ADR and code change.

## Alternatives Considered
- Keep provider switch with Gemini default:
  - rejected to avoid carrying dead/non-target provider code and env complexity.
