import { PublicSiteShell } from "../../../components/public/public-site-shell";

export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string; token?: string }>;
}) {
  const { slug } = await params;
  const { table } = await searchParams;

  return (
    <PublicSiteShell headerAudience="customer">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="font-display text-3xl text-slate-900">Public menu preview</h1>
        <p className="mt-2 text-sm text-slate-600">
          Business: <span className="font-medium">{slug}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Table: <span className="font-medium">{table ?? "N/A"}</span>
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Menu and ordering UI will be implemented in Layer 6. QR context routing is active.
        </p>
      </section>

    </PublicSiteShell>
  );
}
