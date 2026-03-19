import { beforeEach, describe, expect, it, vi } from "vitest";
import RootPage from "../src/app/page";

const redirectMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: any[]) => redirectMock(...args),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

describe("RootPage", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    cookiesMock.mockReset();
    vi.restoreAllMocks();
  });

  it("redirects to /home when auth cookies are missing", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    cookiesMock.mockResolvedValue({
      get: () => undefined,
      getAll: () => [],
    });

    await RootPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/home");
  });

  it("redirects to /dashboard for logged-in business users", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        data: { user: { role: "business" } },
      }),
    } as Response);
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "access_token" ? { value: "access" } : name === "refresh_token" ? { value: "refresh" } : undefined,
      getAll: () => [
        { name: "access_token", value: "access" },
        { name: "refresh_token", value: "refresh" },
      ],
    });

    await RootPage();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /admin for logged-in admin users", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        data: { user: { role: "admin" } },
      }),
    } as Response);
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "access_token" ? { value: "access" } : name === "refresh_token" ? { value: "refresh" } : undefined,
      getAll: () => [
        { name: "access_token", value: "access" },
        { name: "refresh_token", value: "refresh" },
      ],
    });

    await RootPage();

    expect(redirectMock).toHaveBeenCalledWith("/admin");
  });

  it("falls back to /home when /api/auth/me is not valid", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "access_token" ? { value: "access" } : name === "refresh_token" ? { value: "refresh" } : undefined,
      getAll: () => [
        { name: "access_token", value: "access" },
        { name: "refresh_token", value: "refresh" },
      ],
    });

    await RootPage();

    expect(redirectMock).toHaveBeenCalledWith("/home");
  });

  it("uses refresh fallback when /api/auth/me fails and refresh is valid", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 1,
          data: { user: { role: "business" } },
        }),
      } as Response);
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "access_token" ? { value: "access" } : name === "refresh_token" ? { value: "refresh" } : undefined,
      getAll: () => [
        { name: "access_token", value: "access" },
        { name: "refresh_token", value: "refresh" },
      ],
    });

    await RootPage();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
