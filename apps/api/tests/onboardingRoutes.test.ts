import { EventEmitter } from "events";
import jwt from "jsonwebtoken";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import businessRouter from "../src/routes/business";
import adminRouter from "../src/routes/admin";

type Role = "business" | "admin" | "customer";
type BusinessStatus = "pending" | "approved" | "rejected";

type UserRecord = { id: string; email: string; role: Role };
type BusinessRecord = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  address: string;
  phone: string;
  status: BusinessStatus;
  createdAt: Date;
  updatedAt: Date;
};
type RejectionRecord = {
  id: string;
  businessId: string;
  reason: string | null;
  createdAt: Date;
};

const users: UserRecord[] = [];
const businesses: BusinessRecord[] = [];
const rejections: RejectionRecord[] = [];

const withRejections = (business: BusinessRecord) => ({
  ...business,
  rejections: rejections
    .filter((item) => item.businessId === business.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3),
});

vi.mock("../src/prisma", () => ({
  prisma: {
    business: {
      create: vi.fn(async ({ data }) => {
        if (businesses.some((entry) => entry.slug === data.slug)) {
          const err = Object.assign(new Error("unique"), { code: "P2002" });
          throw err;
        }
        const created: BusinessRecord = {
          id: `b_${businesses.length + 1}`,
          userId: data.userId,
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          logoUrl: data.logoUrl ?? null,
          address: data.address,
          phone: data.phone,
          status: data.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        businesses.push(created);
        return created;
      }),
      findMany: vi.fn(async ({ where, include }) => {
        let list = [...businesses];
        if (where?.userId) list = list.filter((item) => item.userId === where.userId);
        if (where?.status) list = list.filter((item) => item.status === where.status);
        list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return include?.rejections ? list.map(withRejections) : list;
      }),
      findFirst: vi.fn(async ({ where }) => {
        let list = [...businesses];
        if (where?.userId) list = list.filter((item) => item.userId === where.userId);
        if (where?.id) list = list.filter((item) => item.id === where.id);
        list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return list[0] ?? null;
      }),
      findUnique: vi.fn(async ({ where, include }) => {
        const business = businesses.find((item) => item.id === where.id) ?? null;
        if (!business) return null;
        return include?.rejections ? withRejections(business) : business;
      }),
      update: vi.fn(async ({ where, data, include }) => {
        const index = businesses.findIndex((item) => item.id === where.id);
        if (index < 0) throw new Error("Business not found");
        if (data.slug && businesses.some((item) => item.slug === data.slug && item.id !== where.id)) {
          const err = Object.assign(new Error("unique"), { code: "P2002" });
          throw err;
        }

        businesses[index] = {
          ...businesses[index],
          ...data,
          updatedAt: new Date(),
        };

        return include?.rejections ? withRejections(businesses[index]) : businesses[index];
      }),
    },
    businessRejection: {
      findFirst: vi.fn(async ({ where }) => {
        const list = rejections
          .filter((item) => item.businessId === where.businessId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return list[0] ?? null;
      }),
      create: vi.fn(async ({ data }) => {
        const created: RejectionRecord = {
          id: `r_${rejections.length + 1}`,
          businessId: data.businessId,
          reason: data.reason ?? null,
          createdAt: new Date(),
        };
        rejections.push(created);
        return created;
      }),
    },
    $transaction: vi.fn(async (operations) => {
      const result = [];
      for (const operation of operations) {
        result.push(await operation);
      }
      return result;
    }),
    user: {
      findUnique: vi.fn(async ({ where: { id } }) => users.find((item) => item.id === id) ?? null),
    },
  },
}));

vi.stubEnv("NODE_ENV", "test");

const waitForResponseEnd = async (res: ReturnType<typeof createMocks>["res"]) => {
  const maxTicks = 200;
  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (res.writableEnded || res._isEndCalled()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Mock response did not complete");
};

const makeToken = (user: UserRecord) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email }, "dev-secret", {
    expiresIn: "15m",
  });

const run = async (
  router: typeof businessRouter,
  method: string,
  url: string,
  {
    body,
    user,
    headers,
  }: { body?: unknown; user?: UserRecord; headers?: Record<string, string> } = {}
) => {
  const token = user ? makeToken(user) : null;
  const { req, res } = createMocks({
    method,
    url,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    eventEmitter: EventEmitter,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).body = body;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).cookies = token ? { access_token: token } : {};

  router.handle(req, res, (err: unknown) => {
    if (err) throw err;
  });

  await waitForResponseEnd(res);
  return res;
};

describe("Layer 3 onboarding routes", () => {
  beforeEach(() => {
    users.length = 0;
    businesses.length = 0;
    rejections.length = 0;

    users.push({ id: "u_business", email: "biz@example.com", role: "business" });
    users.push({ id: "u_admin", email: "admin@example.com", role: "admin" });
  });

  it("creates, lists, gets and resubmits a business profile", async () => {
    const businessUser = users[0];

    const created = await run(businessRouter, "POST", "/profile", {
      user: businessUser,
      body: {
        name: "Cedar Cafe",
        slug: "cedar-cafe",
        description: "Coffee and snacks",
        logoUrl: null,
        address: "12 Market Street",
        phone: "+1-202-000-0000",
      },
    });

    expect(created._getStatusCode()).toBe(201);
    expect(created._getJSONData().data.business.status).toBe("pending");

    const listed = await run(businessRouter, "GET", "/profiles", { user: businessUser });
    expect(listed._getStatusCode()).toBe(200);
    expect(listed._getJSONData().data.businesses).toHaveLength(1);

    const fetched = await run(businessRouter, "GET", "/profile", { user: businessUser });
    expect(fetched._getStatusCode()).toBe(200);
    expect(fetched._getJSONData().data.business.slug).toBe("cedar-cafe");

    businesses[0].status = "rejected";
    rejections.push({
      id: "r_1",
      businessId: businesses[0].id,
      reason: "Missing address proof",
      createdAt: new Date(),
    });

    const patched = await run(businessRouter, "PATCH", "/profile", {
      user: businessUser,
      body: {
        businessId: businesses[0].id,
        address: "44 New Address",
      },
    });

    expect(patched._getStatusCode()).toBe(200);
    expect(patched._getJSONData().data.business.status).toBe("pending");
  });

  it("enforces admin moderation transitions", async () => {
    const adminUser = users[1];

    businesses.push({
      id: "b_pending",
      userId: users[0].id,
      name: "Pending Bistro",
      slug: "pending-bistro",
      description: null,
      logoUrl: null,
      address: "A",
      phone: "1234567",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    businesses.push({
      id: "b_approved",
      userId: users[0].id,
      name: "Approved Bistro",
      slug: "approved-bistro",
      description: null,
      logoUrl: null,
      address: "B",
      phone: "1234567",
      status: "approved",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const listed = await run(adminRouter, "GET", "/businesses", { user: adminUser });
    expect(listed._getStatusCode()).toBe(200);
    expect(listed._getJSONData().data.businesses).toHaveLength(2);

    const approved = await run(adminRouter, "PATCH", "/businesses/b_pending/approve", {
      user: adminUser,
    });
    expect(approved._getStatusCode()).toBe(200);
    expect(approved._getJSONData().data.business.status).toBe("approved");

    const invalid = await run(adminRouter, "PATCH", "/businesses/b_pending/approve", {
      user: adminUser,
    });
    expect(invalid._getStatusCode()).toBe(409);

    businesses[0].status = "pending";
    const rejected = await run(adminRouter, "PATCH", "/businesses/b_pending/reject", {
      user: adminUser,
      body: { reason: "Missing legal docs" },
    });
    expect(rejected._getStatusCode()).toBe(200);
    expect(rejected._getJSONData().data.business.status).toBe("rejected");
  });

  it("gates business operation routes by status", async () => {
    const businessUser = users[0];

    const noProfile = await run(businessRouter, "GET", "/ops/ping", {
      user: businessUser,
    });
    expect(noProfile._getStatusCode()).toBe(403);
    expect(noProfile._getJSONData().error.code).toBe("BUSINESS_PROFILE_REQUIRED");

    businesses.push({
      id: "b_gate",
      userId: users[0].id,
      name: "Gate Bistro",
      slug: "gate-bistro",
      description: null,
      logoUrl: null,
      address: "A",
      phone: "1234567",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const pending = await run(businessRouter, "GET", "/ops/ping", {
      user: businessUser,
      headers: { "x-business-id": "b_gate" },
    });
    expect(pending._getStatusCode()).toBe(403);
    expect(pending._getJSONData().error.code).toBe("BUSINESS_PENDING_APPROVAL");

    businesses[0].status = "rejected";
    rejections.push({
      id: "r_gate",
      businessId: "b_gate",
      reason: "Incomplete phone",
      createdAt: new Date(),
    });

    const rejected = await run(businessRouter, "GET", "/ops/ping", {
      user: businessUser,
      headers: { "x-business-id": "b_gate" },
    });
    expect(rejected._getStatusCode()).toBe(403);
    expect(rejected._getJSONData().error.code).toBe("BUSINESS_REJECTED");

    businesses[0].status = "approved";
    const approved = await run(businessRouter, "GET", "/ops/ping", {
      user: businessUser,
      headers: { "x-business-id": "b_gate" },
    });
    expect(approved._getStatusCode()).toBe(200);
    expect(approved._getJSONData().status).toBe(1);
  });
});
