import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "../src/lib/auth-context";

vi.mock("../src/lib/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../src/lib/api";

const apiFetchMock = apiFetch as unknown as vi.Mock;

const Harness = () => {
  const { user, loading, login, error } = useAuth();
  return (
    <div>
      <span data-testid="status">{loading ? "loading" : user ? user.email : "anon"}</span>
      {error && <span data-testid="error">{error}</span>}
      <button
        onClick={() => login({ email: "a@b.com", password: "password123" })}
        data-testid="login"
      >
        login
      </button>
    </div>
  );
};

describe("AuthProvider", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("logs in and stores user", async () => {
    // Initial /me call rejects
    apiFetchMock.mockRejectedValueOnce(new Error("unauth"));
    // login call
    apiFetchMock.mockResolvedValueOnce({
      user: { id: "1", email: "a@b.com", role: "customer", createdAt: "" },
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("anon");
    });

    fireEvent.click(screen.getByTestId("login"));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("a@b.com");
    });
  });
});
