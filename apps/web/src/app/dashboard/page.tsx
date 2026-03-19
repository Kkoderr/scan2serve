"use client";

import React from "react";
import { useAuth } from "../../lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const {
    user,
    loading,
    logout,
    businesses,
    selectedBusiness,
    selectBusiness,
    businessLoading,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/home");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) return null;

  if (user.role !== "business") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <h1 className="text-3xl font-semibold">Welcome, {user.email}</h1>
        <p className="text-gray-600">Role: {user.role}</p>
        <button
          onClick={logout}
          className="rounded-md bg-black px-4 py-2 text-white"
        >
          Logout
        </button>
      </main>
    );
  }

  if (businessLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading business profile...</p>
      </main>
    );
  }

  if (businesses.length === 0) {
    return (
      <main className="min-h-screen mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-semibold">Business onboarding required</h1>
        <p className="mt-2 text-gray-600">
          Create your first business profile before using dashboard operations.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/dashboard/onboarding")}
            className="rounded-md bg-black px-4 py-2 text-white"
          >
            Start onboarding
          </button>
          <button
            onClick={logout}
            className="rounded-md border border-gray-300 px-4 py-2"
          >
            Logout
          </button>
        </div>
      </main>
    );
  }

  const isBlocked =
    selectedBusiness &&
    (selectedBusiness.status === "pending" || selectedBusiness.status === "rejected");
  const statusLabel =
    selectedBusiness?.status === "pending"
      ? "Pending admin approval"
      : selectedBusiness?.status === "rejected"
        ? "Profile rejected - update and resubmit"
        : "Approved";

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5">
          <div>
            <h1 className="text-2xl font-semibold">Business Dashboard</h1>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard/onboarding")}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              Add business
            </button>
            <button
              onClick={logout}
              className="rounded-md bg-black px-3 py-2 text-sm text-white"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="rounded-xl border bg-white p-4">
          <p className="text-sm font-medium">Your businesses</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <button
                key={business.id}
                onClick={() => selectBusiness(business.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  selectedBusiness?.id === business.id
                    ? "border-black bg-gray-100"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <p className="font-semibold">{business.name}</p>
                <p className="text-sm text-gray-600">{business.slug}</p>
                <span className="mt-3 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs capitalize">
                  {business.status}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="relative rounded-xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active business overview</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/dashboard/menu")}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium"
              >
                Manage menu
              </button>
              <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium">
                {statusLabel}
              </span>
            </div>
          </div>

          <div className={isBlocked ? "pointer-events-none blur-[2px]" : ""}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Today orders</p>
                <p className="mt-2 text-2xl font-semibold">0</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Pending orders</p>
                <p className="mt-2 text-2xl font-semibold">0</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="mt-2 text-2xl font-semibold">$0.00</p>
              </div>
            </div>
          </div>

          {isBlocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 p-6">
              <div className="max-w-md rounded-lg border bg-white p-5 text-center shadow-sm">
                <p className="font-semibold">{statusLabel}</p>
                <p className="mt-2 text-sm text-gray-600">
                  Dashboard operations are disabled until this business is approved.
                </p>
                {selectedBusiness?.status === "rejected" &&
                  !!selectedBusiness.rejections?.length && (
                    <div className="mt-3 rounded-md bg-red-50 p-3 text-left text-xs text-red-800">
                      <p className="font-medium">Recent rejection reasons</p>
                      <ul className="mt-1 space-y-1">
                        {selectedBusiness.rejections.slice(0, 3).map((item) => (
                          <li key={item.id}>{item.reason || "No reason provided"}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                {selectedBusiness?.status === "rejected" && (
                  <button
                    onClick={() => router.push(`/dashboard/onboarding?businessId=${selectedBusiness.id}`)}
                    className="mt-4 rounded-md bg-black px-3 py-2 text-sm text-white"
                  >
                    Edit and resubmit
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
