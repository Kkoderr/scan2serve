import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import NotificationsPage from "../src/app/dashboard/notifications/page";

const useAuthMock = vi.fn();
vi.mock("../src/lib/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

const apiFetchMock = vi.fn();
vi.mock("../src/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

describe("NotificationsPage", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: { id: "u1", email: "biz@example.com", role: "business" },
      businessUser: { id: "u1", email: "biz@example.com", role: "business" },
      customerUser: null,
      loading: false,
    });
    apiFetchMock.mockImplementation((path: unknown) => {
      if (path === "/api/business/subscription/status") {
        return Promise.resolve({
          status: {
            isActive: true,
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            plan: "trial",
            currency: "INR",
            amount: 0,
            daysRemaining: 1,
          },
          canManage: true,
        });
      }

      return Promise.resolve({
        scope: "all",
        unreadCount: 1,
        notifications: [
          {
            id: "n1",
            inboxId: null,
            businessId: "b1",
            businessName: "Cafe Aurora",
            type: "UPDATE_APPROVED",
            message: "Profile approved",
            payload: { currencyCode: "USD" },
            createdAt: new Date().toISOString(),
          },
        ],
      });
    });
  });

  it("renders notifications from API", async () => {
    render(<NotificationsPage />);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Profile approved")).toBeTruthy());
    expect(screen.getByText("Profile approved")).toBeTruthy();
    expect(screen.getByText("Cafe Aurora")).toBeTruthy();
  });
});
