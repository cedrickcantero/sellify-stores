import { describe, expect, it } from "vitest";
import { StoreConfigPatch } from "./store-config-patch";

describe("StoreConfigPatch", () => {
  it("accepts any subset of the config at any depth, including a closed day", () => {
    const patch = {
      brand: { colors: { primary: "#0F766E" }, radius: 12 },
      content: { banner: { enabled: true } },
      openingHours: { sun: null, mon: { open: "09:00", close: "17:00" } },
      tabs: { sell: false },
    };
    expect(StoreConfigPatch.parse(patch)).toEqual(patch);
  });

  it("rejects keys the config does not have, so nothing unexpected reaches the merge", () => {
    for (const patch of [
      { shopId: "other" },
      { brand: { colours: {} } },
      JSON.parse('{"__proto__": {"polluted": true}}'),
      JSON.parse('{"brand": {"__proto__": {"polluted": true}}}'),
    ]) {
      expect(StoreConfigPatch.safeParse(patch).success).toBe(false);
    }
  });

  it("rejects a patch that is not an object", () => {
    for (const patch of [null, "brand", 3, [{ brand: {} }]]) {
      expect(StoreConfigPatch.safeParse(patch).success).toBe(false);
    }
  });

  it("leaves the values to saveDraft, which reports their field errors", () => {
    expect(StoreConfigPatch.safeParse({ brand: { colors: { primary: "teal" } } }).success).toBe(true);
  });
});
