// Pure helpers for protecting public forms from bots and floods.

// A text field hidden from people (off screen, aria-hidden, no tab stop).
// Bots that fill every field fill it too; people leave it empty.
export const HONEYPOT_FIELD = "website";

export function isHoneypotTripped(form: FormData): boolean {
  const value = form.get(HONEYPOT_FIELD);
  return typeof value === "string" ? value.trim() !== "" : value !== null;
}

// The caller's IP for rate limit keys. On Vercel x-real-ip is set by the
// platform to the connecting client (what @vercel/functions ipAddress()
// reads); a client can prepend entries to x-forwarded-for, so that is only
// a fallback for other hosts.
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Test override so suites that sign up and log in repeatedly do not trip
// the limits: RATE_LIMIT_DISABLED=1, honoured only outside production and
// never on Vercel.
export function isRateLimitDisabled(env: Record<string, string | undefined>): boolean {
  return env.RATE_LIMIT_DISABLED === "1" && env.NODE_ENV !== "production" && !env.VERCEL;
}
