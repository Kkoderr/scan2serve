# ADR-025: Auth Entry Guard for Already-Logged-In Sessions

**Date:** 2026-03-20  
**Status:** Accepted  
**Depends on:** ADR-023, ADR-024

## Context
Users can hold active business and customer sessions simultaneously. Login/register pages currently allow auth form submission even when the target scope is already authenticated.

Also, frontend cannot reliably read auth cookie values directly because tokens are `httpOnly`.

## Decision
Before login/register submission, frontend must check current session state and block redundant auth requests when the target scope is already logged in.
Also, all auth dialogs must expose a visible close control.

## Source of Truth
Use existing `GET /api/auth/sessions` (already implemented in ADR-024) as the session-state source.
Do not attempt to read token values from `document.cookie` for auth decisions.

## UX Behavior
### Business auth pages (`/login`, `/register/business`)
- If `businessUser` exists:
  - show `Already logged in as <email>`
  - hide/disable auth form submit actions
  - provide CTA to `/dashboard` or `/admin` by role

### QR customer auth pages (`/qr/login`, `/qr/register`)
- If `customerUser` exists:
  - show `Already logged in as <email>`
  - hide/disable auth form submit actions
  - provide CTA to continue to `/qr/[token]`

### Header behavior
- No change to current dropdown model; this ADR is page/form guard behavior only.

### Auth dialog close control
- Every auth dialog (home, fallback auth pages, QR auth pages) must include a visible close button.
- Close action behavior:
  - dismiss the dialog when inline on page,
  - for route-based auth dialog pages, navigate to a safe destination (`/home` or QR destination context as applicable).
- Close interaction should never submit auth actions implicitly.

## API Call Guard
- `login`, `register`, `loginCustomerFromQr`, `registerCustomerFromQr` should short-circuit on frontend when corresponding scope is already active.
- Guarded flows should show toast/info and avoid hitting auth write endpoints.

## Consequences
### Pros
- Prevents redundant auth API calls.
- Removes confusing “login/register while already logged in” flow.
- Keeps scope behavior explicit.

### Trade-offs
- Requires auth forms/pages to read session state first.
- Slightly more conditional UI in auth entry routes.

## Implementation Checklist
1. Add scope guard checks in auth context methods before API auth calls.
2. Update `/login` and `/register/business` pages/forms to display already-logged-in state.
3. Update `/qr/login` and `/qr/register` pages/forms for customer already-logged-in state.
4. Add visible close button to all auth dialogs with consistent close behavior.
5. Add web tests for blocked-submit, already-logged-in view behavior, and dialog close-control presence/behavior.

## Acceptance Criteria
1. If scope user is already active, login/register submit does not call auth write endpoint.
2. Login/register pages clearly show already-logged-in state for that scope.
3. Existing flows continue for unauthenticated scope users.
4. All auth dialogs expose a visible close button and close predictably without auth side effects.
