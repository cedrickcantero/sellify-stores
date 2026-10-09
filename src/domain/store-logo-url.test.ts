import { describe, expect, it } from "vitest";
import { isShopLogoUrl } from "./store-logo-url";

const HOST = "abc123.public.blob.vercel-storage.com";
const logo = (path: string) => `https://${HOST}${path}`;

describe("isShopLogoUrl", () => {
  it("accepts an uploaded logo on the project's Blob host under the shop's images", () => {
    expect(isShopLogoUrl(logo("/images/shop-1/0b7c9a2e-1f.svg"), "shop-1", HOST)).toBe(true);
    expect(isShopLogoUrl(logo("/images/shop-1/0b7c9a2e-1f.png"), "shop-1", HOST)).toBe(true);
  });

  it("rejects another shop's folder, another host and non-https URLs", () => {
    expect(isShopLogoUrl(logo("/images/shop-2/a.png"), "shop-1", HOST)).toBe(false);
    expect(isShopLogoUrl("https://evil.example/images/shop-1/a.png", "shop-1", HOST)).toBe(false);
    expect(isShopLogoUrl(`http://${HOST}/images/shop-1/a.png`, "shop-1", HOST)).toBe(false);
    expect(isShopLogoUrl("javascript:alert(1)", "shop-1", HOST)).toBe(false);
  });

  it("rejects nested paths, queries and non-image names", () => {
    expect(isShopLogoUrl(logo("/images/shop-1/x/a.png"), "shop-1", HOST)).toBe(false);
    expect(isShopLogoUrl(logo("/images/shop-1/a.png?x=1"), "shop-1", HOST)).toBe(false);
    expect(isShopLogoUrl(logo("/images/shop-1/a.html"), "shop-1", HOST)).toBe(false);
  });

  it("accepts nothing when the Blob host is unknown", () => {
    expect(isShopLogoUrl(logo("/images/shop-1/a.png"), "shop-1", null)).toBe(false);
  });
});
