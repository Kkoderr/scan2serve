# ADR-020: Gemini Image Runtime for Non-Banana Provider

**Date:** 2026-03-20  
**Status:** Superseded by ADR-022

## Context
Current image generation path in API is tightly bound to a Nano-Banana style provider contract:
- `AI_IMAGE_PROVIDER` defaults to `nano-banana`.
- Non-`nano-banana` providers currently return unsupported behavior and fail gracefully.

Requirement now is to support a production-grade non-banana runtime using Gemini APIs for image generation.

We need:
- deterministic provider selection behavior,
- minimal dependency overhead,
- robust timeout/error handling aligned with existing provider flow,
- compatibility with current `generateMenuItemImage()` contract used by menu image route.

## Decision
1. Provider selection
- Keep `AI_IMAGE_PROVIDER` as runtime switch.
- Supported providers after this change:
  - `nano-banana` (existing behavior),
  - `gemini` (new behavior).
- Unknown providers remain non-fatal and return `null` with structured warning logs.

2. Gemini runtime contract
- Add Gemini REST-backed image generation path in `src/services/aiImageProvider.ts`.
- Endpoint pattern:
  - `POST {GEMINI_API_URL}/models/{GEMINI_IMAGE_MODEL}:generateContent?key={GEMINI_API_KEY}`
  - default base URL: `https://generativelanguage.googleapis.com/v1beta`.
- Request shape:
  - text prompt packaged in `contents`.
  - image generation intent via configured model and response modalities where supported.
- Response parsing:
  - accept inline base64 image payload from response parts (`inlineData`).
  - validate MIME type through existing allowed set (`jpeg|png|webp`).
  - return `{ buffer, mimeType }` to existing caller contract.

3. Environment variables
- Add:
  - `GEMINI_API_KEY`,
  - `GEMINI_API_URL` (optional, default to Google endpoint),
  - `GEMINI_IMAGE_MODEL` (default `gemini-3-pro-image-preview`).
- Keep `AI_IMAGE_TIMEOUT_MS` shared across providers.

4. Error and fallback behavior
- Maintain current resilience pattern:
  - timeout -> info log + `null`,
  - HTTP/API parse failures -> warn log + `null`,
  - invalid/missing image payload -> warn log + `null`.
- Business route behavior remains unchanged (`AI_IMAGE_GENERATION_FAILED` if provider returns `null`).

5. Testing
- Add/extend API service-level tests to cover:
  - Gemini success path with inline image payload.
  - Gemini unavailable config path (missing key/model).
  - Gemini HTTP error path.
  - Provider switch behavior (`AI_IMAGE_PROVIDER=gemini` vs `nano-banana`).
- Keep existing route-level tests intact (they mock provider service already).

## Consequences
- Pros:
  - Enables non-banana runtime with standard Gemini APIs.
  - No route contract changes needed.
  - Reuses existing storage and error propagation pipeline.
- Cons:
  - Adds provider-specific response parsing complexity.
  - Gemini model/API behavior may evolve; response parser must stay conservative.

## Alternatives Considered
- Introduce Google SDK dependency now:
  - rejected for initial integration to keep runtime lean and avoid SDK lock-in/version drift.
- Replace Nano-Banana entirely with Gemini:
  - rejected to preserve backward compatibility and staged rollout via provider flag.
