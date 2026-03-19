import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type AuthMeResponse = {
  status: 1 | 0;
  data?: {
    user?: {
      role: "admin" | "business" | "customer";
    };
  };
};

async function resolveRootTarget() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;
  if (!accessToken && !refreshToken) return "/home";

  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const roleToPath = (role?: "admin" | "business" | "customer") => {
    if (role === "admin") return "/admin";
    if (role === "business") return "/dashboard";
    return "/home";
  };

  try {
    const meResponse = await fetch(`${API_BASE}/api/auth/me`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    });
    if (meResponse.ok) {
      const body = (await meResponse.json()) as AuthMeResponse;
      if (body.status === 1 && body.data?.user) {
        return roleToPath(body.data.user.role);
      }
    }

    if (!refreshToken) return "/home";

    const refreshResponse = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    });
    if (!refreshResponse.ok) return "/home";

    const refreshBody = (await refreshResponse.json()) as AuthMeResponse;
    if (refreshBody.status !== 1 || !refreshBody.data?.user) return "/home";

    return roleToPath(refreshBody.data.user.role);
  } catch {
    return "/home";
  }
}

export default async function RootPage() {
  redirect(await resolveRootTarget());
}
