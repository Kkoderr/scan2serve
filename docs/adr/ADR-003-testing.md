# ADR-003: Testing Strategy

**Date:** 2026-03-19  
**Status:** Accepted  
**Context:** Project now mandates tests for every feature. Need consistent stack for backend (Express + Prisma) and frontend (Next.js) plus response-contract checks.

## Decision
- Runner: Vitest for both API and web; coverage via built-in c8.
- Backend integration: supertest against Express app with mocked Prisma (no external DB dependency); future CI can switch to real Postgres.
- Frontend: @testing-library/react with jsdom; mock fetch for API client.
- Response contract: assert `{ status: 1|0, data?, error? }` on all API responses.
- DB strategy (current): in-memory Prisma mocks; revisit real Postgres + migration per-test when infra available.
- Coverage target: start with line 70% project-wide; raise once features stabilize.
- Commands: `pnpm --filter @scan2serve/api test`, `pnpm --filter @scan2serve/web test`.

## Consequences
- Pros: Fast, hermetic tests; shared runner; aligns with new status field contract.
- Cons: Prisma mocking may diverge from real DB; need follow-up to run against Postgres in CI.
- Future work: Add GitHub Actions CI to run test suites + coverage gates once repo is ready for remote builds.
