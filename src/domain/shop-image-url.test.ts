import { describe, expect, it } from "vitest";
import { blobHostForToken, isShopImageUrl } from "./shop-image-url";

const HOST = "abc123.public.blob.vercel-storage.com";
const base = `https://${HOST}`;
const good = `${base}/images/shop-1/photo-x7.png`;

describe("blobHostForToken", () => {
  it("derives the store's public host from the read-write token", () => {
    expect(blobHostForToken("vercel_blob_rw_AbC123_secretpart")).toBe(
      "abc123.public.blob.vercel-storage.com",
    );
  });

  it("returns null for a missing or malformed token", () => {
    expect(blobHostForToken(undefined)).toBeNull();
    expect(blobHostForToken("")).toBeNull();
    expect(blobHostForToken("not-a-token")).toBeNull();
    expect(blobHostForToken("vercel_blob_rw__secret")).toBeNull();
  });
});

describe("isShopImageUrl", () => {
  it("accepts a URL on the store's host under the shop's own images prefix", () => {
    expect(isShopImageUrl(good, "shop-1", HOST)).toBe(true);
  });

  it("accepts nothing when the store host is unknown", () => {
    expect(isShopImageUrl(good, "shop-1", null)).toBe(false);
  });

  it("rejects another Blob store's subdomain", () => {
    expect(
      isShopImageUrl(
        "https://other999.public.blob.vercel-storage.com/images/shop-1/a.png",
        "shop-1",
        HOST,
      ),
    ).toBe(false);
  });

  it("rejects another shop's prefix, including a prefix lookalike", () => {
    expect(isShopImageUrl(good, "shop-2", HOST)).toBe(false);
    expect(isShopImageUrl(good, "shop", HOST)).toBe(false);
  });

  it("rejects non-Blob hosts, plain http, credentials and look-alike hosts", () => {
    expect(isShopImageUrl("https://evil.example.com/images/shop-1/a.png", "shop-1", HOST)).toBe(false);
    expect(isShopImageUrl(`http://${HOST}/images/shop-1/a.png`, "shop-1", HOST)).toBe(false);
    expect(isShopImageUrl(`https://${HOST}.evil.com/images/shop-1/a.png`, "shop-1", HOST)).toBe(false);
    expect(isShopImageUrl(`https://user@${HOST}/images/shop-1/a.png`, "shop-1", HOST)).toBe(false);
  });

  it("rejects path tricks, svg and garbage", () => {
    expect(isShopImageUrl(`${base}/images/shop-1/../shop-2/a.png`, "shop-1", HOST)).toBe(false);
    expect(isShopImageUrl(`${base}/images/shop-1/%2e%2e/shop-2/a.png`, "shop-1", HOST)).toBe(false);
    expect(isShopImageUrl(`${base}/images/shop-1/a.svg`, "shop-1", HOST)).toBe(false);
    expect(isShopImageUrl(`${base}/images/shop-1/`, "shop-1", HOST)).toBe(false);
    expect(isShopImageUrl("not a url", "shop-1", HOST)).toBe(false);
    expect(isShopImageUrl("", "shop-1", HOST)).toBe(false);
  });
});
