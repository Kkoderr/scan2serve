import { EventEmitter } from "events";
import jwt from "jsonwebtoken";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import businessRouter from "../src/routes/business";

const store = vi.hoisted(() => ({
  users: [{ id: "user_1", email: "owner@example.com", role: "business" as const }],
  orgs: [{ id: "org_1", ownerUserId: "user_1" }],
  orgMemberships: [{ id: "orgmem_1", orgId: "org_1", userId: "user_1" }],
  businesses: [{ id: "biz_1", orgId: "org_1", userId: "user_1", status: "approved" as const }],
}));

const prismaMock = vi.hoisted(() => {
  const mock: any = {
    user: {
      findUnique: vi.fn(async ({ where }) => {
        if (where?.id) return store.users.find((u) => u.id === where.id) ?? null;
        if (where?.email) return store.users.find((u) => u.email === where.email) ?? null;
        return null;
      }),
    },
    business: {
      findFirst: vi.fn(async ({ where }) => {
        if (where?.id) return store.businesses.find((b) => b.id === where.id) ?? null;
        if (where?.userId) return store.businesses.find((b) => b.userId === where.userId) ?? null;
        return null;
      }),
    },
    businessMembership: {
      findFirst: vi.fn(async () => ({ role: "owner" })),
      findMany: vi.fn(async () => []),
    },
    businessRejection: { findFirst: vi.fn(async () => null) },
    category: { findMany: vi.fn(async () => []) },
    orgMembership: {
      findFirst: vi.fn(async ({ where }) => {
        const membership = store.orgMemberships.find((m) => m.userId === where?.userId);
        if (!membership) return null;
        return { ...membership, org: store.orgs.find((o) => o.id === membership.orgId) };
      }),
    },
    org: {
      findUnique: vi.fn(async ({ where, select }) => {
        const org = store.orgs.find((o) => o.id === where?.id) ?? null;
        if (!org) return null;
        if (select?.ownerUserId) return { ownerUserId: org.ownerUserId };
        return org;
      }),
    },
    notificationEvent: { create: vi.fn(async (args) => ({ id: "event_1", ...args.data })) },
    notificationInbox: { create: vi.fn(async (args) => ({ id: "inbox_1", ...args.data })) },
  };
  mock.$transaction = vi.fn(async (callback: any) => callback(mock));
  return mock;
});

vi.mock("../src/prisma", () => ({ prisma: prismaMock }));

vi.stubEnv("NODE_ENV", "test");

const makeToken = (userId: string, email: string) =>
  jwt.sign({ sub: userId, role: "business", email }, "dev-secret", { expiresIn: "15m" });

const run = async (
  method: string,
  url: string,
  { body, headers }: { body?: unknown; headers?: Record<string, string> } = {}
) => {
  const token = makeToken("user_1", "owner@example.com");
  const { req, res } = createMocks({
    method,
    url,
    headers: {
      authorization: `Bearer ${token}`,
      ...headers,
    },
    eventEmitter: EventEmitter,
  });

  if (body) {
    req.body = body;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).cookies = { access_token: token };

  businessRouter.handle(req, res, (err: unknown) => {
    if (err) throw err;
  });

  const maxTicks = 200;
  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (res.writableEnded || res._isEndCalled()) return res;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Mock response did not complete");
};

beforeEach(() => {
  (globalThis as { __subscriptionStatus?: unknown }).__subscriptionStatus = {
    isActive: true,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    plan: "trial",
    currency: "INR",
    amount: 0,
    daysRemaining: 7,
  };
});

describe("subscription routes", () => {
  it("returns subscription status with canManage", async () => {
    const res = await run("GET", "/subscription/status");
    const payload = res._getJSONData();
    expect(payload.status).toBe(1);
    expect(payload.data.status.isActive).toBe(true);
    expect(payload.data.canManage).toBe(true);
  });

  it("blocks business routes when subscription inactive", async () => {
    (globalThis as { __subscriptionStatus?: unknown }).__subscriptionStatus = {
      isActive: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      plan: null,
      currency: "INR",
      amount: null,
      daysRemaining: null,
    };

    const res = await run("GET", "/categories", {
      headers: { "x-business-id": "biz_1" },
    });
    const payload = res._getJSONData();
    expect(payload.status).toBe(0);
    expect(payload.error?.code).toBe("SUBSCRIPTION_REQUIRED");
  });
});
