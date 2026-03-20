"use client";

import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";

type AppHeaderProps = {
  leftMeta?: React.ReactNode;
  rightSlot?: React.ReactNode;
  audience?: "default" | "customer";
};

export function AppHeader({ leftMeta, rightSlot, audience = "default" }: AppHeaderProps) {
  const { user, businessUser, customerUser, loading, logoutBusiness, logoutCustomer, logoutAll } =
    useAuth();
  const router = useRouter();
  const [resolvedQrToken, setResolvedQrToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const queryToken = new URLSearchParams(window.location.search).get("token");
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const pathToken =
      pathParts[0] === "qr" && pathParts[1] && !["login", "register"].includes(pathParts[1])
        ? decodeURIComponent(pathParts[1])
        : null;
    const tokenFromUrl = queryToken ?? pathToken;

    if (tokenFromUrl && tokenFromUrl.length >= 12) {
      window.sessionStorage.setItem("last_qr_token", tokenFromUrl);
      setResolvedQrToken(tokenFromUrl);
      return;
    }

    const remembered = window.sessionStorage.getItem("last_qr_token");
    setResolvedQrToken(remembered && remembered.length >= 12 ? remembered : null);
  }, []);

  const primaryUser = businessUser ?? user;

  const roleCta =
    primaryUser?.role === "admin"
      ? { href: "/admin", label: "Admin" }
      : primaryUser?.role === "business"
        ? { href: "/dashboard", label: "Dashboard" }
        : { href: "/home", label: "Home" };

  const hasAnySession = Boolean(businessUser || customerUser);
  const customerLoginHref = resolvedQrToken
    ? `/qr/login?token=${encodeURIComponent(resolvedQrToken)}`
    : "/home";
  const customerHasSession = Boolean(customerUser);

  const businessLoginDropdown = (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
        Login
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
        <Link
          href="/login"
          className={`block rounded px-2.5 py-2 text-xs ${
            businessUser
              ? "pointer-events-none text-slate-400"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Login as business
        </Link>
      </div>
    </details>
  );

  const logoutDropdown = (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
        Logout
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          disabled={!businessUser}
          onClick={() => {
            void logoutBusiness();
            router.refresh();
          }}
          className={`block w-full rounded px-2.5 py-2 text-left text-xs ${
            businessUser
              ? "text-slate-700 hover:bg-slate-50"
              : "cursor-not-allowed text-slate-400"
          }`}
        >
          Logout business
        </button>
        <button
          type="button"
          disabled={!customerUser}
          onClick={() => {
            void logoutCustomer();
            router.refresh();
          }}
          className={`block w-full rounded px-2.5 py-2 text-left text-xs ${
            customerUser
              ? "text-slate-700 hover:bg-slate-50"
              : "cursor-not-allowed text-slate-400"
          }`}
        >
          Logout customer
        </button>
        <button
          type="button"
          disabled={!hasAnySession}
          onClick={() => {
            void logoutAll();
            router.push("/home");
          }}
          className={`block w-full rounded px-2.5 py-2 text-left text-xs ${
            hasAnySession
              ? "text-slate-700 hover:bg-slate-50"
              : "cursor-not-allowed text-slate-400"
          }`}
        >
          Logout all
        </button>
      </div>
    </details>
  );

  const customerLoginDropdown = (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
        Login
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
        <Link
          href={customerLoginHref}
          className={`block rounded px-2.5 py-2 text-xs ${
            customerUser
              ? "pointer-events-none text-slate-400"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Login as customer
        </Link>
      </div>
    </details>
  );

  const customerLogoutDropdown = (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
        Logout
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          disabled={!customerHasSession}
          onClick={() => {
            void logoutCustomer();
            router.refresh();
          }}
          className={`block w-full rounded px-2.5 py-2 text-left text-xs ${
            customerHasSession
              ? "text-slate-700 hover:bg-slate-50"
              : "cursor-not-allowed text-slate-400"
          }`}
        >
          Logout customer
        </button>
      </div>
    </details>
  );

  const customerRight = loading ? (
    <p className="text-xs text-slate-500">Loading session...</p>
  ) : customerUser ? (
    <div className="flex items-center gap-2">
      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
        {customerUser.email}
      </span>
      {customerLoginDropdown}
      {customerLogoutDropdown}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
        Guest session
      </div>
      {customerLoginDropdown}
      {customerLogoutDropdown}
    </div>
  );

  const defaultRight = loading ? (
    <p className="text-xs text-slate-500">Loading profile...</p>
  ) : user || businessUser || customerUser ? (
    <div className="flex items-center gap-2">
      {businessUser ? (
        <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right">
          <p className="max-w-[200px] truncate text-xs font-medium text-slate-800">
            {businessUser.email}
          </p>
          <p className="text-[11px] text-slate-500">Business profile</p>
        </div>
      ) : (
        <Link
          href="/login"
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
        >
          Login as business
        </Link>
      )}
      {customerUser ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-right">
          <p className="max-w-[200px] truncate text-xs font-medium text-sky-800">
            {customerUser.email}
          </p>
          <p className="text-[11px] text-sky-600">Customer profile</p>
        </div>
      ) : null}
      {businessUser ? (
        <Link
          href={roleCta.href}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
        >
          {roleCta.label}
        </Link>
      ) : null}
      {businessLoginDropdown}
      {logoutDropdown}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      {businessLoginDropdown}
      {logoutDropdown}
      <Link
        href="/register/business"
        className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white"
      >
        Register
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-sm font-semibold text-amber-800">
            S2
          </div>
          <div className="min-w-0">
            <Link href="/home" className="font-semibold tracking-tight text-slate-900">
              Scan2Serve
            </Link>
            <div className="truncate text-xs text-slate-500">
              {leftMeta ?? "Menus, QR and ordering"}
            </div>
          </div>
        </div>
        {rightSlot ?? (audience === "customer" ? customerRight : defaultRight)}
      </div>
    </header>
  );
}
