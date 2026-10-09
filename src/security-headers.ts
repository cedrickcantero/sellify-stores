// Security headers sent with every response (wired up in next.config.ts).
//
// script-src allows 'unsafe-inline' because the App Router streams its
// payload in inline scripts; a nonce would need every page to render through
// the proxy. 'unsafe-eval' is only needed by the dev server (React refresh).
// Product photos upload from the browser through the Blob API on vercel.com
// and are served from the project's public Blob host.

const BLOB_IMAGES = "https://*.public.blob.vercel-storage.com";

export function contentSecurityPolicy(dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${BLOB_IMAGES}`,
    "font-src 'self' data:",
    `connect-src 'self' https://vercel.com ${BLOB_IMAGES}${dev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

// Enforced after a report-only run on the live site showed no violations
// from the app (store pages, slot lookup, Stripe redirect, photo upload).
export const ENFORCE_CSP = true;

export function securityHeaders(dev: boolean): { key: string; value: string }[] {
  return [
    {
      key: ENFORCE_CSP ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicy(dev),
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}
