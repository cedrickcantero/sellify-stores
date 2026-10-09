import { describe, expect, it } from "vitest";
import { defaultStoreConfig } from "./store-config";
import { readableOn, storeThemeVars } from "./store-theme";

describe("readableOn", () => {
  it("puts white text on a dark colour and near-black text on a light one", () => {
    expect(readableOn("#0F766E")).toBe("#ffffff");
    expect(readableOn("#1f2937")).toBe("#ffffff");
    expect(readableOn("#F5EFE6")).toBe("#111111");
    expect(readableOn("#fbbf24")).toBe("#111111");
  });
});

describe("storeThemeVars", () => {
  it("derives every store CSS variable from the brand settings only", () => {
    const brand = defaultStoreConfig("FixIt").brand;
    brand.colors = { primary: "#0F766E", accent: "#F97361", background: "#F5EFE6", text: "#1C1917" };
    brand.radius = 12;
    brand.fontPair = "slab";

    expect(storeThemeVars(brand)).toEqual({
      "--store-primary": "#0F766E",
      "--store-on-primary": "#ffffff",
      "--store-accent": "#F97361",
      "--store-on-accent": "#111111",
      "--store-bg": "#F5EFE6",
      "--store-text": "#1C1917",
      "--store-radius": "12px",
      "--store-font-heading": "var(--font-store-slab), Georgia, serif",
      "--store-font-body": "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    });
  });
});
