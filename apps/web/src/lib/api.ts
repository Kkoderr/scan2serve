"use client";

import type { ApiResponse } from "@scan2serve/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const defaultHeaders = {
  "Content-Type": "application/json",
};

async function parseResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const data = await res.json();
  return data as ApiResponse<T>;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  { retryOn401 = true }: { retryOn401?: boolean } = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 401 && retryOn401) {
    const refreshed = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    const refreshBody = await parseResponse<unknown>(refreshed);
    if (refreshBody.status === 1) {
      return apiFetch<T>(path, options, { retryOn401: false });
    }
  }

  const body = await parseResponse<T>(response);
  if (body.status === 1 && body.data !== undefined) {
    return body.data;
  }
  const message = body.error?.message || "Request failed";
  throw new Error(message);
}
