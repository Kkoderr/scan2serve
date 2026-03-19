"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";

const getPasswordChecks = (value: string) => ({
  minLength: value.length >= 8,
  hasUpper: /[A-Z]/.test(value),
  hasLower: /[a-z]/.test(value),
  hasNumber: /\d/.test(value),
  hasSymbol: /[^A-Za-z0-9]/.test(value),
});

export default function BusinessRegisterPage() {
  const { register, error } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const checks = getPasswordChecks(password);
  const isStrong =
    checks.minLength &&
    checks.hasUpper &&
    checks.hasLower &&
    checks.hasNumber &&
    checks.hasSymbol;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirmPassword) {
      setLocalError("Password and confirm password do not match.");
      return;
    }
    if (!isStrong) {
      setLocalError("Please use a stronger password before creating your account.");
      return;
    }
    setLoading(true);
    try {
      await register({ email, password, role: "business" });
      router.push("/dashboard");
    } catch {
      // handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md rounded-lg border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-center">
          Create business account
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Start with your work email and a secure password.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Work email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Create password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
            <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs text-gray-700">
              <p className="font-medium">Password requirements</p>
              <ul className="mt-1 space-y-1">
                <li>{checks.minLength ? "✓" : "•"} At least 8 characters</li>
                <li>{checks.hasUpper ? "✓" : "•"} One uppercase letter</li>
                <li>{checks.hasLower ? "✓" : "•"} One lowercase letter</li>
                <li>{checks.hasNumber ? "✓" : "•"} One number</li>
                <li>{checks.hasSymbol ? "✓" : "•"} One special character</li>
              </ul>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          {localError && <p className="text-sm text-red-600">{localError}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !isStrong}
            className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create business account"}
          </button>
        </form>
      </div>
    </main>
  );
}
