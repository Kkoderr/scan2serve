const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, "");

const splitOrigins = (value: string) =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const getConfiguredCorsOrigins = (): string[] => {
  const raw = process.env.CORS_ORIGINS?.trim();
  const fallback = process.env.CLIENT_URL?.trim();
  const origins = raw ? splitOrigins(raw) : fallback ? [fallback] : [];
  return origins.map(normalizeOrigin);
};

export const isAllowedOrigin = (
  origin: string | undefined | null,
  allowedOrigins: string[]
): boolean => {
  if (!origin) return true; // non-browser / same-origin fetch without Origin header
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes(normalized);
};

