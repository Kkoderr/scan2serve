"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";

type FormState = {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  address: string;
  phone: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  logoUrl: "",
  address: "",
  phone: "",
};

function BusinessOnboardingPageContent() {
  const {
    user,
    loading,
    businesses,
    createBusinessProfile,
    updateBusinessProfile,
    refreshBusinessProfiles,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = searchParams.get("businessId");

  const existing = useMemo(
    () => businesses.find((business) => business.id === businessId) ?? null,
    [businesses, businessId]
  );

  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (user?.role !== "business") {
      router.push("/dashboard");
    }
  }, [loading, user, router]);

  useEffect(() => {
    refreshBusinessProfiles();
  }, [refreshBusinessProfiles]);

  useEffect(() => {
    if (!existing) {
      setForm(emptyForm);
      return;
    }

    setForm({
      name: existing.name,
      slug: existing.slug,
      description: existing.description ?? "",
      logoUrl: existing.logoUrl ?? "",
      address: existing.address,
      phone: existing.phone,
    });
  }, [existing]);

  if (loading || !user || user.role !== "business") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        logoUrl: form.logoUrl || null,
        address: form.address,
        phone: form.phone,
      };

      if (existing) {
        await updateBusinessProfile({ businessId: existing.id, ...payload });
      } else {
        await createBusinessProfile(payload);
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <section className="mx-auto max-w-2xl rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-semibold">
          {existing ? "Edit business profile" : "Create business profile"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This information is reviewed by admins before business operations are enabled.
        </p>
        {existing?.status === "rejected" && !!existing.rejections?.length && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">Recent rejection reasons</p>
            <ul className="mt-1 list-disc pl-4">
              {existing.rejections.slice(0, 3).map((item) => (
                <li key={item.id}>{item.reason || "No reason provided"}</li>
              ))}
            </ul>
          </div>
        )}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-1 text-sm">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="rounded-md border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Slug</span>
            <input
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({ ...current, slug: event.target.value }))
              }
              className="rounded-md border px-3 py-2"
              required
              pattern="[a-z0-9-]+"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Address</span>
            <input
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
              className="rounded-md border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              className="rounded-md border px-3 py-2"
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Description (optional)</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              className="rounded-md border px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Logo URL (optional)</span>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, logoUrl: event.target.value }))
              }
              className="rounded-md border px-3 py-2"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? "Saving..." : existing ? "Save changes" : "Create profile"}
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2"
              onClick={() => router.push("/dashboard")}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function BusinessOnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p>Loading...</p>
        </main>
      }
    >
      <BusinessOnboardingPageContent />
    </Suspense>
  );
}
