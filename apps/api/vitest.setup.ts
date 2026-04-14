import { afterEach, vi } from "vitest";

const defaultSubscriptionStatus = {
  isActive: true,
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  plan: "trial",
  currency: "INR",
  amount: 0,
  daysRemaining: 7,
};

(globalThis as { __subscriptionStatus?: typeof defaultSubscriptionStatus }).__subscriptionStatus =
  defaultSubscriptionStatus;

vi.mock("./src/services/subscriptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./src/services/subscriptions")>();
  return {
    ...actual,
    getOrgSubscriptionStatus: vi.fn(async () => {
      return (globalThis as { __subscriptionStatus?: typeof defaultSubscriptionStatus })
        .__subscriptionStatus ?? defaultSubscriptionStatus;
    }),
    createOrgTrialSubscription: vi.fn(async (params: { orgId: string; createdByUserId: string }) => {
      return {
        id: "orgsub_test",
        orgId: params.orgId,
        plan: "trial",
        amount: 0,
        currency: "INR",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdByUserId: params.createdByUserId,
      };
    }),
  };
});

// Clear all mocks between tests
afterEach(() => {
  vi.clearAllMocks();
});
