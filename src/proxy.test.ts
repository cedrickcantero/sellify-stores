import { getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

beforeEach(() => {
  vi.stubEnv("APP_HOST", "sellify.example.com");
  vi.stubEnv("STORE_ROOT_DOMAIN", "stores.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers: { host: new URL(url).host, ...headers } });
}

describe("proxy", () => {
  it("leaves backend requests on the app host alone", () => {
    const response = proxy(request("https://sellify.example.com/dashboard"));
    expect(isRewrite(response)).toBe(false);
  });

  it("leaves /s/<slug> store paths alone on any host", () => {
    expect(isRewrite(proxy(request("https://sellify.example.com/s/fixit-galway/shop")))).toBe(false);
    expect(isRewrite(proxy(request("https://fixit.ie/s/fixit-galway")))).toBe(false);
  });

  it("rewrites a store subdomain to the store pages, resolved by host", () => {
    const response = proxy(request("https://fixit-galway.stores.example.com/repair?x=1"));
    expect(isRewrite(response)).toBe(true);
    expect(getRewrittenUrl(response)).toBe("https://fixit-galway.stores.example.com/s/_host/repair?x=1");
  });

  it("rewrites a custom domain home page", () => {
    const response = proxy(request("https://fixitgalway.ie/"));
    expect(getRewrittenUrl(response)).toBe("https://fixitgalway.ie/s/_host");
  });

  it("does not rewrite an already rewritten path again", () => {
    expect(isRewrite(proxy(request("https://fixitgalway.ie/s/_host/shop")))).toBe(false);
  });

  it("marks preview requests as never cached and flags them for the store layout", () => {
    const response = proxy(request("https://sellify.example.com/s/fixit-galway?preview=1"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-middleware-request-x-sellify-store-preview")).toBe("1");
  });

  it("drops a preview flag the browser sent itself", () => {
    const response = proxy(
      request("https://sellify.example.com/s/fixit-galway", { "x-sellify-store-preview": "1" }),
    );
    expect(response.headers.get("x-middleware-request-x-sellify-store-preview")).toBeNull();
  });

  it("does not run for static assets or the API", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/_next/static/chunk.js" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/auth/session" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/logo.svg" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/s/fixit-galway/shop" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/" })).toBe(true);
  });
});
