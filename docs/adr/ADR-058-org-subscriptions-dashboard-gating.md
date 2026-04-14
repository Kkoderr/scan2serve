# ADR-058: Org Subscriptions + Dashboard Gating

**Date:** 2026-04-13
**Status:** Accepted

## Context
We need subscription-based access for the business dashboard. Owners/managers opening the dashboard must be validated against an org-level subscription. If the subscription is valid, access continues; otherwise access is halted and a subscription purchase flow is presented. Subscription status should be cached for faster access. Only Razorpay is allowed for subscription payments. A subscription page should present three plans (1 month $4, 3 months $10, 1 year $20) and allow only owners/managers to view/purchase. Payment IDs must be stored in a separate table with a `subscription` tag. New orgs should receive a 1-month free subscription on creation.

## Decision
- Add an org-scoped subscription model (e.g., `OrgSubscription`) that stores current plan, status, and period window (`currentPeriodStart`, `currentPeriodEnd`).
- Add a separate payment record table (e.g., `PaymentRecord`) that stores provider, Razorpay order/payment IDs, amount/currency, orgId, and a `tag` column with enum value `subscription` for subscription payments.
- Add subscription checkout + verification endpoints under `/api/business/subscription/*`, restricted to business users with owner/manager role.
- Use Razorpay order creation + signature verification (same approach as orders) to activate a subscription and record payment.
- Add a Redis-backed cache for org subscription status with a configurable TTL; fallback to DB on cache miss or Redis failure.
- Enforce dashboard access for owner/manager by checking subscription status; if inactive/expired, route to the subscription page.
- Add a subscription page in the dashboard UI with the three plan cards and Razorpay checkout.
- When a new org is created, grant a free 1-month subscription window (no payment record required).

## Consequences
- Introduces new DB models + migrations (subscription + payment records) and new API endpoints.
- Requires Razorpay configuration for subscription checkout in non-test environments.
- Adds Redis read/write calls for subscription status; if Redis is unavailable, DB is used.
- UI must handle subscription-required state for owner/manager flows and present a purchase path.

## Questions & Answers

### Questions for User
- Q1: What currency should the subscription prices use in Razorpay (the prompt lists `$4/$10/$20` but Razorpay is commonly INR)?
- Q2: Should an active subscription be extended (add duration to `currentPeriodEnd`) when purchasing a new plan, or should it reset from the purchase date?
- Q3: Should staff users be blocked from the dashboard when the org subscription is inactive, or is the check only for owners/managers?
- Q4: Should subscription enforcement happen only at the dashboard UI level, or should API business routes also enforce subscription for owner/manager actions?
- Q5: Do we need a grace period after expiry (e.g., allow access for N days) or is access blocked immediately when `currentPeriodEnd < now`?

### Answers (to be filled by user)
- A1: Use ruppee (300/800/2000)
- A2: search for the currEnd date if the end date is not expired then create a new entry with new start date with +1 of curr end date and new end date set accordingly. But if it is expired create new entry with start date as the curr date. To validate always search for the farthest end date for an org.
- A3: yes they should be blocked to but, the payement to renew can only be made by the owner or manager.
- A4: Block both api+Ui
- A5: immediately. But you can send notification to the manager and owner of that org about the expiry.

