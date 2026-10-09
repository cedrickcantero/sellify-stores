import { describe, expect, it } from "vitest";
import { defaultStoreConfig, fieldErrorsOf, mergeStoreConfig, StoreConfig } from "./store-config";

const valid = () => defaultStoreConfig("FixIt Galway");

describe("StoreConfig", () => {
  it("accepts the default config for a shop", () => {
    const parsed = StoreConfig.safeParse(valid());
    expect(parsed.success).toBe(true);
  });

  it("fills every missing field with its default", () => {
    const parsed = StoreConfig.parse({ brand: { name: "FixIt Galway" } });

    expect(parsed).toEqual({
      template: "clean",
      brand: {
        name: "FixIt Galway",
        colors: { primary: "#1f2937", accent: "#f97316", background: "#ffffff", text: "#111827" },
        fontPair: "modern",
        radius: 8,
      },
      content: { banner: { enabled: false, text: "" }, about: "" },
      contact: { phone: "", email: "", address: "" },
      openingHours: {
        mon: { open: "09:00", close: "18:00" },
        tue: { open: "09:00", close: "18:00" },
        wed: { open: "09:00", close: "18:00" },
        thu: { open: "09:00", close: "18:00" },
        fri: { open: "09:00", close: "18:00" },
        sat: { open: "10:00", close: "16:00" },
        sun: null,
      },
      repair: { slotMinutes: 30, slotCapacity: 1 },
      tabs: { shop: true, repair: true, sell: true },
    });
  });

  it("defaultStoreConfig uses the shop name as the store name", () => {
    expect(defaultStoreConfig("Phone Clinic Cork").brand.name).toBe("Phone Clinic Cork");
  });

  it.each(["0F766E", "#0F766", "#GGGGGG", "teal", "#0F766E00", "rgb(0,0,0)"])(
    "rejects the colour %s",
    (colour) => {
      const config = valid();
      config.brand.colors.primary = colour;
      const parsed = StoreConfig.safeParse(config);

      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      expect(Object.keys(fieldErrorsOf(parsed.error))).toEqual(["brand.colors.primary"]);
    },
  );

  it("accepts a six-digit hex colour in either case", () => {
    const config = valid();
    config.brand.colors.primary = "#0F766E";
    config.brand.colors.accent = "#f97361";
    expect(StoreConfig.safeParse(config).success).toBe(true);
  });

  it("rejects opening hours where close is before open", () => {
    const config = valid();
    config.openingHours.tue = { open: "17:00", close: "09:00" };
    const parsed = StoreConfig.safeParse(config);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(fieldErrorsOf(parsed.error)).toEqual({
      "openingHours.tue.close": "Closing time must be after opening time.",
    });
  });

  it("rejects opening hours where close equals open", () => {
    const config = valid();
    config.openingHours.wed = { open: "09:00", close: "09:00" };
    expect(StoreConfig.safeParse(config).success).toBe(false);
  });

  it("rejects a time that is not HH:mm", () => {
    const config = valid();
    config.openingHours.mon = { open: "9am", close: "25:00" };
    const parsed = StoreConfig.safeParse(config);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(Object.keys(fieldErrorsOf(parsed.error)).sort()).toEqual([
      "openingHours.mon.close",
      "openingHours.mon.open",
    ]);
  });

  it("accepts a closed day as null", () => {
    const config = valid();
    config.openingHours.mon = null;
    expect(StoreConfig.safeParse(config).success).toBe(true);
  });

  it("rejects an unknown template", () => {
    const parsed = StoreConfig.safeParse({ ...valid(), template: "fancy" });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(Object.keys(fieldErrorsOf(parsed.error))).toEqual(["template"]);
  });

  it("rejects a slot length other than 15, 30 or 60 minutes", () => {
    const config = { ...valid(), repair: { slotMinutes: 45, slotCapacity: 1 } };
    expect(StoreConfig.safeParse(config).success).toBe(false);
  });

  it("rejects an empty store name and a bad contact email", () => {
    const config = valid();
    config.brand.name = "  ";
    config.contact.email = "not-an-email";
    const parsed = StoreConfig.safeParse(config);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(Object.keys(fieldErrorsOf(parsed.error)).sort()).toEqual(["brand.name", "contact.email"]);
  });

  it("only accepts an https logo URL", () => {
    const config = valid();
    config.brand.logoUrl = "javascript:alert(1)";
    expect(StoreConfig.safeParse(config).success).toBe(false);
    config.brand.logoUrl = "https://blob.example.com/images/shop/logo.svg";
    expect(StoreConfig.safeParse(config).success).toBe(true);
  });
});

describe("mergeStoreConfig", () => {
  it("merges a nested patch and keeps every other field", () => {
    const merged = mergeStoreConfig(valid(), {
      brand: { colors: { primary: "#0F766E" } },
      openingHours: { sun: { open: "12:00", close: "16:00" } },
    });

    expect(merged.brand.colors).toEqual({
      primary: "#0F766E",
      accent: "#f97316",
      background: "#ffffff",
      text: "#111827",
    });
    expect(merged.brand.name).toBe("FixIt Galway");
    expect(merged.openingHours.sun).toEqual({ open: "12:00", close: "16:00" });
    expect(merged.openingHours.mon).toEqual({ open: "09:00", close: "18:00" });
  });

  it("closes a day when the patch sets it to null", () => {
    const merged = mergeStoreConfig(valid(), { openingHours: { mon: null } });
    expect(merged.openingHours.mon).toBeNull();
  });

  it("does not change the config it was given", () => {
    const base = valid();
    mergeStoreConfig(base, { brand: { name: "Other" } });
    expect(base.brand.name).toBe("FixIt Galway");
  });
});
