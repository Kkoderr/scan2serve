import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppHeader } from "../src/components/layout/app-header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const useAuthMock = vi.fn();
vi.mock("../src/lib/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

describe("AppHeader", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("hides dashboard CTA in customer audience mode", () => {
    useAuthMock.mockReturnValue({
      loading: false,
      user: { id: "c1", email: "cust@example.com", role: "customer" },
      businessUser: { id: "u1", email: "biz@example.com", role: "business" },
      customerUser: { id: "c1", email: "cust@example.com", role: "customer" },
      logoutBusiness: vi.fn(),
      logoutCustomer: vi.fn(),
      logoutAll: vi.fn(),
    });

    render(<AppHeader audience="customer" />);

    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.getByText("Login")).toBeTruthy();
    expect(screen.getByText("Logout")).toBeTruthy();
    fireEvent.click(screen.getByText("Login"));
    expect(screen.queryByText("Login as business")).toBeNull();
    expect(screen.getByText("Login as customer")).toBeTruthy();
    fireEvent.click(screen.getByText("Logout"));
    expect(screen.queryByText("Logout business")).toBeNull();
    expect(screen.getByText("Logout customer")).toBeTruthy();
  });

  it("shows only business login action in default audience mode", () => {
    useAuthMock.mockReturnValue({
      loading: false,
      user: { id: "u1", email: "biz@example.com", role: "business" },
      businessUser: { id: "u1", email: "biz@example.com", role: "business" },
      customerUser: null,
      logoutBusiness: vi.fn(),
      logoutCustomer: vi.fn(),
      logoutAll: vi.fn(),
    });

    render(<AppHeader audience="default" />);

    fireEvent.click(screen.getByText("Login"));
    expect(screen.getByText("Login as business")).toBeTruthy();
    expect(screen.queryByText("Login as customer")).toBeNull();
    expect(screen.getByText("Logout")).toBeTruthy();
  });
});
