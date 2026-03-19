"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastRecord } from "../../lib/toast";

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setToasts((current) => [...current, toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((entry) => entry.id !== toast.id));
      }, toast.durationMs);
    });
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`rounded-lg border bg-white px-3 py-2 shadow-md ${
            toast.variant === "error"
              ? "border-red-200"
              : toast.variant === "success"
                ? "border-emerald-200"
                : "border-slate-200"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.title && <p className="text-sm font-semibold text-slate-900">{toast.title}</p>}
          <p
            className={`text-sm ${
              toast.variant === "error"
                ? "text-red-700"
                : toast.variant === "success"
                  ? "text-emerald-700"
                  : "text-slate-700"
            }`}
          >
            {toast.message}
          </p>
        </article>
      ))}
    </div>
  );
}

