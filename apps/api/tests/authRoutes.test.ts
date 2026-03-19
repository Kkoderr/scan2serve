import { EventEmitter } from "events";
import { createMocks } from "node-mocks-http";
import { describe, it, expect, beforeEach, vi } from "vitest";
import authRouter from "../src/routes/auth";

const users: any[] = [];
const refreshTokens: any[] = [];

vi.mock("../src/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where: { email, id } }) => {
        if (email) return users.find((u) => u.email === email) || null;
        if (id) return users.find((u) => u.id === id) || null;
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const user = { id: `${users.length + 1}`, ...data };
        users.push(user);
        return user;
      }),
    },
    refreshToken: {
      create: vi.fn(async ({ data }) => {
        const rec = { id: `${refreshTokens.length + 1}`, ...data };
        refreshTokens.push(rec);
        return rec;
      }),
      findUnique: vi.fn(async ({ where: { tokenHash } }) =>
        refreshTokens.find((t) => t.tokenHash === tokenHash) || null
      ),
      update: vi.fn(async ({ where: { id }, data }) => {
        const idx = refreshTokens.findIndex((t) => t.id === id);
        if (idx >= 0) refreshTokens[idx] = { ...refreshTokens[idx], ...data };
        return refreshTokens[idx];
      }),
      updateMany: vi.fn(async ({ where: { tokenHash }, data }) => {
        refreshTokens.forEach((t, i) => {
          if (t.tokenHash === tokenHash) {
            refreshTokens[i] = { ...t, ...data };
          }
        });
      }),
    },
  },
}));

vi.stubEnv("JWT_SECRET", "test-secret");
vi.stubEnv("ACCESS_TOKEN_TTL_MINUTES", "15");
vi.stubEnv("REFRESH_TOKEN_TTL_DAYS", "7");
vi.stubEnv("NODE_ENV", "test");

const parseCookies = (cookieHeader?: string) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [k, v] = part.trim().split("=");
    if (k) acc[k] = decodeURIComponent(v || "");
    return acc;
  }, {} as Record<string, string>);
};

type SupportedMethod = "post";

const getRouteHandler = (method: SupportedMethod, path: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = (authRouter as any).stack.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (entry: any) => entry.route?.path === path && entry.route?.methods?.[method]
  );
  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }
  return layer.route.stack[0].handle;
};

const waitForResponseEnd = async (res: ReturnType<typeof createMocks>["res"]) => {
  const maxTicks = 200;
  for (let tick = 0; tick < maxTicks; tick += 1) {
    // node-mocks-http tracks "ended" with either writableEnded or _isEndCalled.
    if (res.writableEnded || res._isEndCalled()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Mock response did not complete");
};

const run = async (method: SupportedMethod, path: string, body?: any, cookies?: string) => {
  const { req, res } = createMocks({
    method: method.toUpperCase(),
    url: path,
    headers: cookies ? { cookie: cookies } : undefined,
    eventEmitter: EventEmitter,
  });

  // Bypass parser middleware for isolated router tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).body = body;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).cookies = parseCookies(cookies);

  const handler = getRouteHandler(method, path);
  handler(req, res, (err: unknown) => {
    if (err) throw err;
  });
  await waitForResponseEnd(res);

  return res;
};

describe("auth routes", () => {
  beforeEach(() => {
    users.length = 0;
    refreshTokens.length = 0;
  });

  it("registers and logs in a user, issues cookies", async () => {
    const registerRes = await run("post", "/register", {
      email: "a@b.com",
      password: "password123",
      role: "customer",
    });
    expect(registerRes._getStatusCode()).toBe(201);
    expect(registerRes._getJSONData().status).toBe(1);

    const loginRes = await run("post", "/login", {
      email: "a@b.com",
      password: "password123",
    });
    expect(loginRes._getStatusCode()).toBe(200);
    expect(loginRes._getJSONData().status).toBe(1);
    expect(refreshTokens).toHaveLength(1);
  });

  it("rejects invalid credentials", async () => {
    await run("post", "/register", {
      email: "x@y.com",
      password: "password123",
      role: "customer",
    });

    const res = await run("post", "/login", {
      email: "x@y.com",
      password: "wrongpass",
    });
    expect(res._getStatusCode()).toBe(401);
    expect(res._getJSONData().status).toBe(0);
  });
});
