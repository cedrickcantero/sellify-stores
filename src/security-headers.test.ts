import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const header = (dev: boolean, key: string) => securityHeaders(dev).find((h) => h.key === key)?.value;

describe("security headers", () => {
  it("forbids framing, sniffing and plugins", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(header(false, "X-Frame-Options")).toBe("DENY");
    expect(header(false, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("enforces the content security policy", () => {
    expect(header(false, "Content-Security-Policy")).toBe(contentSecurityPolicy(false));
    expect(header(false, "Content-Security-Policy-Report-Only")).toBeUndefined();
  });

  it("allows eval only on the dev server", () => {
    expect(contentSecurityPolicy(false)).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });

  it("lets forms post only to the app and to Stripe Checkout", () => {
    expect(contentSecurityPolicy(false)).toContain("form-action 'self' https://checkout.stripe.com");
  });

  it("loads images only from the app and the project's Blob store", () => {
    expect(contentSecurityPolicy(false)).toContain(
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    );
  });
});
