# ADR-009: API Singleton Logger and Structured Request Logging

**Date:** 2026-03-20  
**Status:** Accepted

## Context
API logs are currently minimal and use direct `console.log/error` calls in `src/index.ts`, which makes endpoint diagnostics shallow and inconsistent.
We need a single logging mechanism that can be reused across API modules and produces more detailed, machine-readable request lifecycle logs.

## Decision
1. Add a singleton logger utility at `apps/api/src/utils/logger.ts`.
2. Replace direct logging in API bootstrap with the singleton logger.
3. Log structured request lifecycle events for all endpoints:
- `http.request.start`
- `http.request.finish`
- `http.request.aborted`
- `http.request.error`
4. Include useful context in logs:
- request ID (generated or forwarded from `x-request-id`)
- method, path, URL, status code
- duration (ms), response bytes
- client IP, user agent
- authenticated user context (`userId`, `userRole`) when available
5. Keep output JSON-line friendly for local and production ingestion.

## Consequences
- Pros:
  - Consistent logging API (`logger.info/warn/error/debug`) across the backend.
  - Better endpoint observability and easier troubleshooting.
  - Request correlation via `x-request-id`.
- Cons:
  - Slightly noisier logs at default info level.
  - Added maintenance around logging context fields.

## Alternatives Considered
- Keep direct `console.*` logging: rejected due to inconsistent format and limited context.
- Introduce heavy logging framework immediately: deferred to keep dependencies minimal for current scope.
