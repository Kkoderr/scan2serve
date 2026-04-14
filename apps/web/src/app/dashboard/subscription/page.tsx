"use client";

import React from "react";
import { SUBSCRIPTION_PLANS, type PaidSubscriptionPlan } from "@scan2serve/shared";
import { AppHeader } from "../../../components/layout/app-header";
import { BodyBackButton } from "../../../components/layout/body-back-button";
import { apiFetch } from "../../../lib/api";
import { showToast } from "../../../lib/toast";
import { useAuth } from "../../../lib/auth-context";
import { useSubscriptionStatus } from "../../../lib/subscription";
import { useRouter } from "next/navigation";

type RazorpayCheckoutResponse = {
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
  planId: PaidSubscriptionPlan;
};

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error: { description?: string } }) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const loadRazorpayScript = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay unavailable"));
      return;
    }
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount
  );

const formatDate = (value: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
};

export default function SubscriptionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { status, canManage, loading, refresh } = useSubscriptionStatus();
  const [processingPlan, setProcessingPlan] = React.useState<PaidSubscriptionPlan | null>(null);

  React.useEffect(() => {
    if (loading) return;
    if (status && !canManage) {
      showToast({"message":"Only owners or managers can manage subscriptions.", title: "Anauthorized"});
      router.replace("/dashboard/subscription/locked");
    }
  }, [loading, status, canManage, router]);

  const handleCheckout = async (planId: PaidSubscriptionPlan) => {
    setProcessingPlan(planId);
    try {
      const checkout = await apiFetch<RazorpayCheckoutResponse>(
        "/api/business/subscription/checkout",
        {
          method: "POST",
          body: JSON.stringify({ plan: planId }),
        }
      );

      await loadRazorpayScript();
      if (!window.Razorpay) {
        throw new Error("Razorpay checkout unavailable.");
      }

      const plan = SUBSCRIPTION_PLANS.find((entry) => entry.id === planId);
      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "Scan2Serve",
        description: plan ? `Subscription: ${plan.label}` : "Subscription",
        order_id: checkout.razorpayOrderId,
        prefill: {
          name: user?.email ?? undefined,
        },
        notes: {
          planId,
        },
        handler: async (response: RazorpayHandlerResponse) => {
          await apiFetch("/api/business/subscription/verify", {
            method: "POST",
            body: JSON.stringify({
              plan: planId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          showToast({message: "Subscription updated."});
          await refresh();
        },
        modal: {
          ondismiss: () => {
            showToast({message:"Subscription checkout cancelled."});
          },
        },
      });

      razorpay.on("payment.failed", (response) => {
        showToast({message: response.error?.description ?? "Payment failed."});
      });

      razorpay.open();
    } catch (error) {
      showToast({message : "Subscription checkout failed."});
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading || !status) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-slate-100">
        <AppHeader leftMeta="Subscription" />
        <section className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center p-6">
          <p>Loading subscription...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-slate-100">
      <AppHeader leftMeta="Subscription" />
      <section className="mx-auto max-w-5xl space-y-8 p-6">
        <BodyBackButton />
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-3xl font-semibold">Org subscription</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            Keep your dashboard active by maintaining an org subscription.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className={`rounded-full px-3 py-1 ${status.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {status.isActive ? "Active" : "Inactive"}
            </div>
            {status.currentPeriodEnd && (
              <div className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Valid until {formatDate(status.currentPeriodEnd)}
              </div>
            )}
            {status.daysRemaining !== null && status.isActive && (
              <div className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {status.daysRemaining} days remaining
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <h2 className="text-xl font-semibold">{plan.label}</h2>
                <p className="mt-2 text-3xl font-semibold">
                  {formatCurrency(plan.amount, plan.currency)}
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                  {plan.months} month access
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCheckout(plan.id)}
                disabled={processingPlan === plan.id}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {processingPlan === plan.id ? "Processing..." : "Pay with Razorpay"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
