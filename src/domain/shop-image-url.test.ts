import { describe, expect, it } from "vitest";
import { isShopImageUrl } from "./shop-image-url";

const host = "https://abc123.public.blob.vercel-storage.com";
const good = `${host}/images/shop-1/photo-x7.png`;

describe("isShopImageUrl", () => {
  it("accepts a Blob URL under the shop's own images prefix", () => {
    expect(isShopImageUrl(good, "shop-1")).toBe(true);
  });

  it("rejects another shop's prefix, including a prefix lookalike", () => {
    expect(isShopImageUrl(good, "shop-2")).toBe(false);
    expect(isShopImageUrl(good, "shop")).toBe(false);
  });

  it("rejects non-Blob hosts, plain http and look-alike hosts", () => {
    expect(isShopImageUrl("https://evil.example.com/images/shop-1/a.png", "shop-1")).toBe(false);
    expect(
      isShopImageUrl("http://abc.public.blob.vercel-storage.com/images/shop-1/a.png", "shop-1"),
    ).toBe(false);
    expect(
      isShopImageUrl("https://public.blob.vercel-storage.com.evil.com/images/shop-1/a.png", "shop-1"),
    ).toBe(false);
    expect(
      isShopImageUrl("https://user@abc.public.blob.vercel-storage.com/images/shop-1/a.png", "shop-1"),
    ).toBe(false);
  });

  it("rejects path tricks, svg and garbage", () => {
    expect(isShopImageUrl(`${host}/images/shop-1/../shop-2/a.png`, "shop-1")).toBe(false);
    expect(isShopImageUrl(`${host}/images/shop-1/%2e%2e/shop-2/a.png`, "shop-1")).toBe(false);
    expect(isShopImageUrl(`${host}/images/shop-1/a.svg`, "shop-1")).toBe(false);
    expect(isShopImageUrl(`${host}/images/shop-1/`, "shop-1")).toBe(false);
    expect(isShopImageUrl("not a url", "shop-1")).toBe(false);
    expect(isShopImageUrl("", "shop-1")).toBe(false);
  });
});
