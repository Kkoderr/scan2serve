"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SubscriptionStatus } from "@scan2serve/shared";
import { apiFetch } from "./api";
import { showToast } from "./toast";
import { useAuth } from "./auth-context";

export const useSubscriptionStatus = () => {
  const { user } = useAuth();
  const [status, setStatus] = React.useState<SubscriptionStatus | null>(null);
  const [canManage, setCanManage] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!user || user.role !== "business") {
      setStatus(null);
      setCanManage(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ status: SubscriptionStatus; canManage: boolean }>(
        "/api/business/subscription/status",
        { method: "GET" }
      );
      setStatus(data.status);
      setCanManage(data.canManage);
    } catch {
      setStatus(null);
      setCanManage(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, canManage, loading, refresh };
};

export const useSubscriptionGate = (options?: { allowInactive?: boolean }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { status, canManage, loading } = useSubscriptionStatus();
  const toastShownRef = React.useRef(false);

  React.useEffect(() => {
    if (loading) return;
    if (!status) return;
    if (options?.allowInactive) return;
    if (status.isActive) return;

    if (!toastShownRef.current) {
      showToast({message: "Active subscription required to access the dashboard."});
      toastShownRef.current = true;
    }

    if (pathname.startsWith("/dashboard/subscription")) return;

    if (canManage) {
      router.replace("/dashboard/subscription");
    } else {
      router.replace("/dashboard/subscription/locked");
    }
  }, [loading, status, canManage, pathname, router, options?.allowInactive]);

  return {
    status,
    canManage,
    loading,
    blocked: Boolean(status && !status.isActive && !options?.allowInactive),
  };
};
