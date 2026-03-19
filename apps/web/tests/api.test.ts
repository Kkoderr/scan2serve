import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiFetch } from "../src/lib/api";

const makeResponse = (body: any, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

describe("apiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns data on success", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(makeResponse({ status: 1, data: { ok: true } }));

    const data = await apiFetch<{ ok: boolean }>("/api/health");
    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 401 by calling refresh then original request", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(makeResponse({ status: 0, error: { message: "Unauthorized" } }, { status: 401 }))
      .mockResolvedValueOnce(makeResponse({ status: 1, data: { user: { id: "1" } } }))
      .mockResolvedValueOnce(makeResponse({ status: 1, data: { ok: true } }));

    const data = await apiFetch<{ ok: boolean }>("/api/protected");
    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/auth/refresh");
  });

  it("throws on error status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeResponse({ status: 0, error: { message: "Bad" } }, { status: 400 })
    );

    await expect(apiFetch("/api/fail")).rejects.toThrow("Bad");
  });
});
