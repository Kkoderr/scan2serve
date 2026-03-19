# docs — Architecture and Process Records

## What this is
Project documentation for architecture decisions, process notes, and operational guidance.

## Conventions
- ADR files live in `docs/adr/` and use the `ADR-XXX-title.md` naming pattern.
- ADRs should include: Date, Status, Context, Decision, Consequences.
- Keep ADR status explicit (`Proposed`, `Accepted`, `Superseded`) and update when approved.

## Updates 2026-03-19
- Added `docs/adr/ADR-004-business-onboarding.md` as a proposed decision for Layer 3 onboarding + admin approval gate.
- Follow-up: once approved, implement Layer 3 and update ADR-004 status to `Accepted`.
- Regenerated ADR-004 with explicit lifecycle, endpoint scope, gating middleware decisions, alternatives considered, and required test coverage.
- Regenerated ADR-004 again with a mandatory 10-question ambiguity checklist to be answered in-ADR before implementation approval.
- Resolved all 10 ADR-004 ambiguity questions directly in the ADR with explicit implementation choices (status defaults, middleware error contract, dashboard gating UX, test policy, multi-business direction).
- ADR-004 status moved from `Proposed` to `Accepted`; Layer 3 implementation started with backend routes, frontend onboarding flow, and tests.
