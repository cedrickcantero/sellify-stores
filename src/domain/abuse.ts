// Pure helpers for protecting public forms from bots and floods.

// A text field hidden from people (off screen, aria-hidden, no tab stop).
// Bots that fill every field fill it too; people leave it empty.
export const HONEYPOT_FIELD = "website";

export function isHoneypotTripped(form: FormData): boolean {
  const value = form.get(HONEYPOT_FIELD);
  return typeof value === "string" ? value.trim() !== "" : value !== null;
}

// The caller's IP for rate limit keys. On Vercel x-forwarded-for is set by
// the platform; the first entry is the client.
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}
