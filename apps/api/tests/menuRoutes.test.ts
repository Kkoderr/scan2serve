import { EventEmitter } from "events";
import jwt from "jsonwebtoken";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import businessRouter from "../src/routes/business";

type BusinessStatus = "pending" | "approved" | "rejected";
type UserRecord = { id: string; email: string; role: "business" | "admin" | "customer" };
type BusinessRecord = { id: string; userId: string; status: BusinessStatus };
type CategoryRecord = {
  id: string;
  businessId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
};
type MenuItemRecord = {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  dietaryTags: string[];
  isAvailable: boolean;
  sortOrder: number;
  createdAt: Date;
};

const users: UserRecord[] = [];
const businesses: BusinessRecord[] = [];
const categories: CategoryRecord[] = [];
const menuItems: MenuItemRecord[] = [];

const nextCategoryId = () => `cat_${categories.length + 1}`;
const nextItemId = () => `item_${menuItems.length + 1}`;

vi.mock("../src/prisma", () => ({
  prisma: {
    business: {
      findFirst: vi.fn(async ({ where }) => {
        let list = [...businesses];
        if (where?.id) list = list.filter((b) => b.id === where.id);
        if (where?.userId) list = list.filter((b) => b.userId === where.userId);
        return list[0] ?? null;
      }),
      findMany: vi.fn(async ({ where }) => {
        let list = [...businesses];
        if (where?.userId) list = list.filter((b) => b.userId === where.userId);
        return list;
      }),
    },
    businessRejection: {
      findFirst: vi.fn(async () => null),
    },
    category: {
      findMany: vi.fn(async ({ where }) =>
        categories
          .filter((c) => c.businessId === where.businessId)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      ),
      findFirst: vi.fn(async ({ where }) =>
        categories.find(
          (c) =>
            (where?.id ? c.id === where.id : true) &&
            (where?.businessId ? c.businessId === where.businessId : true)
        ) ?? null
      ),
      aggregate: vi.fn(async ({ where }) => {
        const list = categories.filter((c) => c.businessId === where.businessId);
        const max = list.length ? Math.max(...list.map((c) => c.sortOrder)) : null;
        return { _max: { sortOrder: max } };
      }),
      create: vi.fn(async ({ data }) => {
        if (categories.some((c) => c.businessId === data.businessId && c.name === data.name)) {
          const err = Object.assign(new Error("unique"), { code: "P2002" });
          throw err;
        }
        const created: CategoryRecord = {
          id: nextCategoryId(),
          businessId: data.businessId,
          name: data.name,
          sortOrder: data.sortOrder,
          createdAt: new Date(),
        };
        categories.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }) => {
        const index = categories.findIndex((c) => c.id === where.id);
        categories[index] = { ...categories[index], ...data };
        return categories[index];
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const index = categories.findIndex(
          (c) => c.id === where.id && c.businessId === where.businessId
        );
        if (index >= 0) categories[index] = { ...categories[index], ...data };
        return { count: index >= 0 ? 1 : 0 };
      }),
      delete: vi.fn(async ({ where }) => {
        const index = categories.findIndex((c) => c.id === where.id);
        if (index >= 0) categories.splice(index, 1);
      }),
    },
    menuItem: {
      count: vi.fn(async ({ where }) => {
        return menuItems.filter((m) =>
          Object.entries(where).every(([k, v]) => (m as any)[k] === v)
        ).length;
      }),
      aggregate: vi.fn(async ({ where }) => {
        const list = menuItems.filter((m) => m.businessId === where.businessId);
        const max = list.length ? Math.max(...list.map((m) => m.sortOrder)) : null;
        return { _max: { sortOrder: max } };
      }),
      findMany: vi.fn(async ({ where, skip = 0, take = 20 }) =>
        menuItems
          .filter((m) =>
            Object.entries(where).every(([k, v]) => (m as any)[k] === v)
          )
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .slice(skip, skip + take)
      ),
      findFirst: vi.fn(async ({ where }) =>
        menuItems.find(
          (m) =>
            (where?.id ? m.id === where.id : true) &&
            (where?.businessId ? m.businessId === where.businessId : true)
        ) ?? null
      ),
      create: vi.fn(async ({ data }) => {
        const created: MenuItemRecord = {
          id: nextItemId(),
          businessId: data.businessId,
          categoryId: data.categoryId,
          name: data.name,
          description: data.description ?? null,
          price: String(data.price),
          imageUrl: data.imageUrl ?? null,
          dietaryTags: data.dietaryTags ?? [],
          isAvailable: data.isAvailable ?? true,
          sortOrder: data.sortOrder,
          createdAt: new Date(),
        };
        menuItems.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }) => {
        const index = menuItems.findIndex((m) => m.id === where.id);
        menuItems[index] = { ...menuItems[index], ...data };
        return menuItems[index];
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const index = menuItems.findIndex(
          (m) => m.id === where.id && m.businessId === where.businessId
        );
        if (index >= 0) menuItems[index] = { ...menuItems[index], ...data };
        return { count: index >= 0 ? 1 : 0 };
      }),
      delete: vi.fn(async ({ where }) => {
        const index = menuItems.findIndex((m) => m.id === where.id);
        if (index >= 0) menuItems.splice(index, 1);
      }),
    },
    $transaction: vi.fn(async (ops) => Promise.all(ops)),
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

  businessRouter.handle(req, res, (err: unknown) => {
    if (err) throw err;
  });

  await waitForResponseEnd(res);
  return res;
};

describe("Layer 4 menu routes", () => {
  beforeEach(() => {
    users.length = 0;
    businesses.length = 0;
    categories.length = 0;
    menuItems.length = 0;

    users.push({ id: "u_business", email: "biz@example.com", role: "business" });
    businesses.push({ id: "b_1", userId: "u_business", status: "approved" });
  });

  it("supports category CRUD and blocks deleting non-empty category", async () => {
    const user = users[0];
    const created = await run("POST", "/categories", {
      user,
      headers: { "x-business-id": "b_1" },
      body: { name: "Starters" },
    });
    expect(created._getStatusCode()).toBe(201);
    const categoryId = created._getJSONData().data.category.id;

    const listed = await run("GET", "/categories", {
      user,
      headers: { "x-business-id": "b_1" },
    });
    expect(listed._getStatusCode()).toBe(200);
    expect(listed._getJSONData().data.categories).toHaveLength(1);

    await run("POST", "/menu-items", {
      user,
      headers: { "x-business-id": "b_1" },
      body: {
        categoryId,
        name: "Tomato Soup",
        price: "9.99",
      },
    });

    const blockedDelete = await run("DELETE", `/categories/${categoryId}`, {
      user,
      headers: { "x-business-id": "b_1" },
    });
    expect(blockedDelete._getStatusCode()).toBe(409);
    expect(blockedDelete._getJSONData().error.code).toBe("CATEGORY_NOT_EMPTY");
  });

  it("rejects duplicate category names for the same business", async () => {
    const user = users[0];

    const first = await run("POST", "/categories", {
      user,
      headers: { "x-business-id": "b_1" },
      body: { name: "Desserts" },
    });
    expect(first._getStatusCode()).toBe(201);

    const duplicate = await run("POST", "/categories", {
      user,
      headers: { "x-business-id": "b_1" },
      body: { name: "Desserts" },
    });
    expect(duplicate._getStatusCode()).toBe(409);
    expect(duplicate._getJSONData().error.code).toBe("CATEGORY_EXISTS");
  });

  it("prefers approved business when header is absent and user has mixed statuses", async () => {
    const user = users[0];
    businesses.length = 0;
    businesses.push({ id: "b_pending", userId: "u_business", status: "pending" });
    businesses.push({ id: "b_approved", userId: "u_business", status: "approved" });

    const created = await run("POST", "/categories", {
      user,
      body: { name: "Beverages" },
    });

    expect(created._getStatusCode()).toBe(201);
    expect(created._getJSONData().data.category.businessId).toBe("b_approved");
  });

  it("returns category and item suggestions excluding existing entries", async () => {
    const user = users[0];
    const createdCategory = await run("POST", "/categories", {
      user,
      headers: { "x-business-id": "b_1" },
      body: { name: "Beverages" },
    });
    const categoryId = createdCategory._getJSONData().data.category.id;

    const itemCreate = await run("POST", "/menu-items", {
      user,
      headers: { "x-business-id": "b_1" },
      body: {
        categoryId,
        name: "Lemon Iced Tea",
        price: "5.00",
      },
    });
    expect(itemCreate._getStatusCode()).toBe(201);

    const categorySuggestions = await run("GET", "/menu-suggestions/categories", {
      user,
      headers: { "x-business-id": "b_1" },
    });
    expect(categorySuggestions._getStatusCode()).toBe(200);
    const categoryLabels = categorySuggestions
      ._getJSONData()
      .data.suggestions.map((item: { label: string }) => item.label);
    expect(categoryLabels).not.toContain("Beverages");

    const itemSuggestions = await run(
      "GET",
      `/menu-suggestions/items?categoryId=${categoryId}`,
      {
        user,
        headers: { "x-business-id": "b_1" },
      }
    );
    expect(itemSuggestions._getStatusCode()).toBe(200);
    const suggestedItems = itemSuggestions._getJSONData().data.suggestions as Array<{
      label: string;
      dietaryTags: string[];
    }>;
    expect(suggestedItems.map((item) => item.label)).not.toContain("Lemon Iced Tea");
    expect(suggestedItems.some((item) => item.dietaryTags.length > 0)).toBe(true);
  });

  it("supports menu item CRUD, availability, reorder and pagination", async () => {
    const user = users[0];
    const cat = await run("POST", "/categories", {
      user,
      headers: { "x-business-id": "b_1" },
      body: { name: "Main" },
    });
    const categoryId = cat._getJSONData().data.category.id;

    const created = await run("POST", "/menu-items", {
      user,
      headers: { "x-business-id": "b_1" },
      body: {
        categoryId,
        name: "Burger",
        price: "12.50",
        dietaryTags: ["halal"],
      },
    });
    expect(created._getStatusCode()).toBe(201);
    const itemId = created._getJSONData().data.item.id;

    const availability = await run("PATCH", `/menu-items/${itemId}/availability`, {
      user,
      headers: { "x-business-id": "b_1" },
      body: { isAvailable: false },
    });
    expect(availability._getStatusCode()).toBe(200);
    expect(availability._getJSONData().data.item.isAvailable).toBe(false);

    const reordered = await run("POST", "/menu-items/reorder", {
      user,
      headers: { "x-business-id": "b_1" },
      body: { orders: [{ id: itemId, sortOrder: 0 }] },
    });
    expect(reordered._getStatusCode()).toBe(200);

    const paged = await run("GET", "/menu-items?page=1&limit=10", {
      user,
      headers: { "x-business-id": "b_1" },
    });
    expect(paged._getStatusCode()).toBe(200);
    expect(paged._getJSONData().data.total).toBe(1);
    expect(paged._getJSONData().data.items[0].id).toBe(itemId);

    const deleted = await run("DELETE", `/menu-items/${itemId}`, {
      user,
      headers: { "x-business-id": "b_1" },
    });
    expect(deleted._getStatusCode()).toBe(200);
  });

  it("validates menu-item update payloads and category ownership", async () => {
    const user = users[0];
    const cat = await run("POST", "/categories", {
      user,
      headers: { "x-business-id": "b_1" },
      body: { name: "Main" },
    });
    const categoryId = cat._getJSONData().data.category.id;

    const created = await run("POST", "/menu-items", {
      user,
      headers: { "x-business-id": "b_1" },
      body: {
        categoryId,
        name: "Pasta",
        price: "13.00",
      },
    });
    const itemId = created._getJSONData().data.item.id;

    const invalidPrice = await run("PATCH", `/menu-items/${itemId}`, {
      user,
      headers: { "x-business-id": "b_1" },
      body: { price: "12.999" },
    });
    expect(invalidPrice._getStatusCode()).toBe(400);
    expect(invalidPrice._getJSONData().error.code).toBe("VALIDATION_ERROR");

    const missingCategory = await run("PATCH", `/menu-items/${itemId}`, {
      user,
      headers: { "x-business-id": "b_1" },
      body: { categoryId: "cat_missing" },
    });
    expect(missingCategory._getStatusCode()).toBe(404);
    expect(missingCategory._getJSONData().error.code).toBe("CATEGORY_NOT_FOUND");
  });

  it("enforces approved-business gating for menu routes", async () => {
    const user = users[0];
    businesses[0].status = "pending";
    const res = await run("GET", "/categories", {
      user,
      headers: { "x-business-id": "b_1" },
    });
    expect(res._getStatusCode()).toBe(403);
    expect(res._getJSONData().error.code).toBe("BUSINESS_PENDING_APPROVAL");
  });
});
