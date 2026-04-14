"use client";

import { AppHeader } from "../../../../components/layout/app-header";
import { BodyBackButton } from "../../../../components/layout/body-back-button";

export default function SubscriptionLockedPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-slate-100">
      <AppHeader leftMeta="Subscription" />
      <section className="mx-auto max-w-4xl space-y-6 p-6">
        <BodyBackButton />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-100">
          <h1 className="text-2xl font-semibold">Subscription required</h1>
          <p className="mt-2 text-sm">
            Your org subscription is inactive. Ask an owner or manager to renew the subscription to
            restore dashboard access.
          </p>
        </div>
      </section>
    </main>
  );
}
