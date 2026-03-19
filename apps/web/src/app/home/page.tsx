import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-4xl font-bold">Scan2Serve</h1>
        <p className="mt-4 text-gray-600">Digital menu platform for restaurants</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/register/business"
            className="rounded-md border border-gray-300 px-4 py-3 text-sm font-medium"
          >
            Register Business
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-black px-4 py-3 text-sm font-medium text-white"
          >
            Business Login
          </Link>
        </div>
      </div>
    </main>
  );
}
