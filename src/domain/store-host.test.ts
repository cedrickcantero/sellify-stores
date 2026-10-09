import { describe, expect, it } from "vitest";
import { classifyRequest, storeAddress, STORE_HOST_SEGMENT } from "./store-host";

const env = { appHost: "sellify.example.com", storeRootDomain: "stores.example.com" };

describe("classifyRequest", () => {
  it("sends the app host to the backend", () => {
    expect(classifyRequest("sellify.example.com", "/dashboard", env)).toEqual({ kind: "app" });
  });

  it("ignores the port and letter case of the host", () => {
    expect(classifyRequest("Sellify.Example.com:443", "/", env)).toEqual({ kind: "app" });
  });

  it.each(["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "sellify-git-x-team.vercel.app"])(
    "treats %s as the app host",
    (host) => {
      expect(classifyRequest(host, "/dashboard", env)).toEqual({ kind: "app" });
    },
  );

  it("resolves a /s/<slug> path by slug on any host", () => {
    for (const host of ["sellify.example.com", "localhost:3000", "fixit.ie", "x.vercel.app"]) {
      expect(classifyRequest(host, "/s/fixit-galway/shop", env)).toEqual({
        kind: "path",
        slug: "fixit-galway",
      });
    }
  });

  it("resolves a subdomain of the store root domain by slug", () => {
    expect(classifyRequest("fixit-galway.stores.example.com", "/repair", env)).toEqual({
      kind: "subdomain",
      slug: "fixit-galway",
    });
  });

  it("does not treat nested subdomains or the root domain itself as a slug", () => {
    expect(classifyRequest("a.b.stores.example.com", "/", env)).toEqual({
      kind: "domain",
      hostname: "a.b.stores.example.com",
    });
    expect(classifyRequest("stores.example.com", "/", env)).toEqual({
      kind: "domain",
      hostname: "stores.example.com",
    });
  });

  it("sends any other host to custom domain lookup", () => {
    expect(classifyRequest("www.FixIt.ie", "/", env)).toEqual({ kind: "domain", hostname: "www.fixit.ie" });
  });

  it("treats the host rewrite segment as host based, not as a slug", () => {
    expect(classifyRequest("fixit.ie", `/s/${STORE_HOST_SEGMENT}/shop`, env)).toEqual({
      kind: "domain",
      hostname: "fixit.ie",
    });
    expect(classifyRequest("localhost:3000", `/s/${STORE_HOST_SEGMENT}`, env)).toEqual({ kind: "app" });
  });

  it("works without a store root domain", () => {
    expect(classifyRequest("fixit.stores.example.com", "/", { appHost: "localhost:3000" })).toEqual({
      kind: "domain",
      hostname: "fixit.stores.example.com",
    });
  });

  it("gives a subdomain of localhost to the store when localhost is the store root", () => {
    expect(
      classifyRequest("fixit.localhost:3000", "/", { appHost: "localhost:3000", storeRootDomain: "localhost" }),
    ).toEqual({ kind: "subdomain", slug: "fixit" });
  });
});

describe("storeAddress", () => {
  it("uses the store root domain when configured", () => {
    expect(storeAddress("fixit-galway", { storeRootDomain: "stores.example.com", origin: "https://app.example.com" })).toBe(
      "https://fixit-galway.stores.example.com",
    );
  });

  it("falls back to the /s/<slug> path on the current origin", () => {
    expect(storeAddress("fixit-galway", { origin: "http://localhost:3000" })).toBe(
      "http://localhost:3000/s/fixit-galway",
    );
  });
});
