import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forShop } from "@/data";
import { STORE_HOST_SEGMENT } from "@/domain/store-host";
import { seedTwoShops } from "@/test/seed";
import { getStoreSettings, getStorefront, publishStore, resolveStore, saveDraft, setStoreOnline } from "./store";

beforeEach(() => {
  vi.stubEnv("APP_HOST", "sellify.example.com");
  vi.stubEnv("STORE_ROOT_DOMAIN", "stores.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publish gating", () => {
  it("a store that was never published is offline", async () => {
    const { shopA } = await seedTwoShops();
    expect(await getStorefront(shopA.shopId, { preview: false })).toMatchObject({ status: "offline" });

    await saveDraft(shopA.shopId, { brand: { name: "FixIt" } });
    expect(await getStorefront(shopA.shopId, { preview: false })).toMatchObject({ status: "offline" });
  });

  it("publishStore makes the draft live and sets the store online", async () => {
    const { shopA } = await seedTwoShops();
    await saveDraft(shopA.shopId, { brand: { name: "FixIt Galway Online", colors: { primary: "#0F766E" } } });

    expect(await publishStore(shopA.shopId, shopA.owner.userId)).toEqual({ ok: true, value: undefined });

    const store = await getStorefront(shopA.shopId, { preview: false });
    expect(store.status).toBe("live");
    if (store.status !== "live") return;
    expect(store.config.brand.name).toBe("FixIt Galway Online");
    expect(store.config.brand.colors.primary).toBe("#0F766E");
  });

  it("draft edits stay invisible to customers until the next publish", async () => {
    const { shopA } = await seedTwoShops();
    await saveDraft(shopA.shopId, { content: { about: "Version one" } });
    await publishStore(shopA.shopId, shopA.owner.userId);

    await saveDraft(shopA.shopId, { content: { about: "Version two" } });
    const before = await getStorefront(shopA.shopId, { preview: false });
    expect(before.status === "live" && before.config.content.about).toBe("Version one");

    await publishStore(shopA.shopId, shopA.owner.userId);
    const after = await getStorefront(shopA.shopId, { preview: false });
    expect(after.status === "live" && after.config.content.about).toBe("Version two");
  });

  it("each publish appends a version row with who published it", async () => {
    const { shopA } = await seedTwoShops();
    await publishStore(shopA.shopId, shopA.owner.userId);
    await saveDraft(shopA.shopId, { content: { about: "Second" } });
    await publishStore(shopA.shopId, shopA.owner.userId);

    const versions = await forShop(shopA.shopId).storeConfig.listVersions();
    expect(versions).toHaveLength(2);
    expect(versions.every((v) => v.publishedBy === shopA.owner.userId)).toBe(true);
    expect(versions.map((v) => (v.config.content as { about: string }).about).sort()).toEqual(["", "Second"]);
  });

  it("an offline store reports offline and comes back with setStoreOnline", async () => {
    const { shopA } = await seedTwoShops();
    await publishStore(shopA.shopId, shopA.owner.userId);

    await setStoreOnline(shopA.shopId, false);
    expect(await getStorefront(shopA.shopId, { preview: false })).toMatchObject({ status: "offline" });

    await setStoreOnline(shopA.shopId, true);
    expect((await getStorefront(shopA.shopId, { preview: false })).status).toBe("live");
  });

  it("switching an unpublished store online still reports offline", async () => {
    const { shopA } = await seedTwoShops();
    await setStoreOnline(shopA.shopId, true);
    expect(await getStorefront(shopA.shopId, { preview: false })).toMatchObject({ status: "offline" });
  });

  it("the offline page carries the published brand, or the shop name before any publish", async () => {
    const { shopA } = await seedTwoShops();
    const never = await getStorefront(shopA.shopId, { preview: false });
    expect(never.status === "offline" && never.brand.name).toBe("FixIt Galway");

    await saveDraft(shopA.shopId, { brand: { name: "Published name" } });
    await publishStore(shopA.shopId, shopA.owner.userId);
    await saveDraft(shopA.shopId, { brand: { name: "Unpublished draft name" } });
    await setStoreOnline(shopA.shopId, false);
    const offline = await getStorefront(shopA.shopId, { preview: false });
    expect(offline.status === "offline" && offline.brand.name).toBe("Published name");
  });
});

describe("saveDraft", () => {
  it("starts from the default config named after the shop", async () => {
    const { shopA } = await seedTwoShops();
    const saved = await saveDraft(shopA.shopId, { contact: { phone: "091 123456" } });

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.brand.name).toBe("FixIt Galway");
    expect(saved.value.contact.phone).toBe("091 123456");
    expect(saved.value.repair).toEqual({ slotMinutes: 30, slotCapacity: 1 });
  });

  it("rejects an invalid patch with field errors and keeps the stored draft", async () => {
    const { shopA } = await seedTwoShops();
    await saveDraft(shopA.shopId, { brand: { colors: { primary: "#0F766E" } } });

    const saved = await saveDraft(shopA.shopId, {
      brand: { colors: { primary: "teal" } },
      openingHours: { mon: { open: "18:00", close: "09:00" } },
    });

    expect(saved).toEqual({
      ok: false,
      error: {
        "brand.colors.primary": "Enter a colour like #0F766E.",
        "openingHours.mon.close": "Closing time must be after opening time.",
      },
    });
    const ok = await saveDraft(shopA.shopId, {});
    expect(ok.ok && ok.value.brand.colors.primary).toBe("#0F766E");
  });
});

describe("saveDraft logo", () => {
  const HOST = "abc123.public.blob.vercel-storage.com";

  it("accepts only a logo uploaded to this project's Blob store for this shop", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_abc123_secretpart");
    const { shopA, shopB } = await seedTwoShops();
    const mine = `https://${HOST}/images/${shopA.shopId}/0b7c9a2e.svg`;

    const ok = await saveDraft(shopA.shopId, { brand: { logoUrl: mine } });
    expect(ok.ok && ok.value.brand.logoUrl).toBe(mine);

    for (const logoUrl of [
      "https://evil.example/logo.png",
      `https://${HOST}/images/${shopB.shopId}/0b7c9a2e.png`,
    ]) {
      expect(await saveDraft(shopA.shopId, { brand: { logoUrl } })).toEqual({
        ok: false,
        error: { "brand.logoUrl": "Upload the logo again." },
      });
    }
  });
});

describe("getStoreSettings", () => {
  it("reports the draft and whether the store is published and online", async () => {
    const { shopA } = await seedTwoShops();
    expect(await getStoreSettings(shopA.shopId)).toMatchObject({
      draft: { brand: { name: "FixIt Galway" } },
      published: false,
      online: false,
    });

    await saveDraft(shopA.shopId, { brand: { name: "FixIt" } });
    await publishStore(shopA.shopId, shopA.owner.userId);
    await setStoreOnline(shopA.shopId, false);
    expect(await getStoreSettings(shopA.shopId)).toMatchObject({
      draft: { brand: { name: "FixIt" } },
      published: true,
      online: false,
    });
  });
});

describe("preview", () => {
  it("shows the draft to a member of the shop", async () => {
    const { shopA } = await seedTwoShops();
    await saveDraft(shopA.shopId, { content: { about: "Draft about" } });

    const store = await getStorefront(shopA.shopId, { preview: true, userId: shopA.owner.userId });
    expect(store.status === "live" && store.config.content.about).toBe("Draft about");
    expect(store.status === "live" && store.draft).toBe(true);
  });

  it("does not show the draft to a member without the preview flag", async () => {
    const { shopA } = await seedTwoShops();
    await saveDraft(shopA.shopId, { content: { about: "Draft about" } });

    expect(await getStorefront(shopA.shopId, { preview: false, userId: shopA.owner.userId })).toMatchObject({
      status: "offline",
    });
  });

  it("shows the published config to a user from another shop", async () => {
    const { shopA, shopB } = await seedTwoShops();
    await saveDraft(shopA.shopId, { content: { about: "Published about" } });
    await publishStore(shopA.shopId, shopA.owner.userId);
    await saveDraft(shopA.shopId, { content: { about: "Secret draft" } });

    const asB = await getStorefront(shopA.shopId, { preview: true, userId: shopB.owner.userId });
    expect(asB.status === "live" && asB.config.content.about).toBe("Published about");
    expect(asB.status === "live" && asB.draft).toBeUndefined();
    const anonymous = await getStorefront(shopA.shopId, { preview: true });
    expect(anonymous.status === "live" && anonymous.config.content.about).toBe("Published about");
  });
});

describe("resolveStore", () => {
  it("resolves a /s/<slug> path on the app host, a preview host and any other host", async () => {
    const { shopA } = await seedTwoShops();
    const expected = { shopId: shopA.shopId, slug: shopA.slug, basePath: `/s/${shopA.slug}` };

    expect(await resolveStore("sellify.example.com", `/s/${shopA.slug}`)).toEqual(expected);
    expect(await resolveStore("sellify-git-x.vercel.app", `/s/${shopA.slug}/shop`)).toEqual(expected);
    expect(await resolveStore("localhost:3000", `/s/${shopA.slug}`)).toEqual(expected);
  });

  it("resolves a subdomain of the store root domain", async () => {
    const { shopA, shopB } = await seedTwoShops();

    expect(await resolveStore(`${shopA.slug}.stores.example.com`, "/")).toEqual({
      shopId: shopA.shopId,
      slug: shopA.slug,
      basePath: "",
    });
    expect(await resolveStore(`${shopB.slug}.stores.example.com`, `/s/${STORE_HOST_SEGMENT}/shop`)).toEqual({
      shopId: shopB.shopId,
      slug: shopB.slug,
      basePath: "",
    });
  });

  it("resolves a verified custom domain and nothing for a pending one", async () => {
    const { shopA, shopB } = await seedTwoShops();
    await forShop(shopA.shopId).customDomains.add({ hostname: "fixitgalway.ie", status: "verified" });
    await forShop(shopB.shopId).customDomains.add({ hostname: "phoneclinic.ie", status: "pending" });

    expect(await resolveStore("FixItGalway.ie", "/")).toEqual({
      shopId: shopA.shopId,
      slug: shopA.slug,
      basePath: "",
    });
    expect(await resolveStore("phoneclinic.ie", "/")).toBeNull();
  });

  it("returns null for unknown slugs, unknown hosts and the app host", async () => {
    await seedTwoShops();

    expect(await resolveStore("sellify.example.com", "/s/no-such-shop")).toBeNull();
    expect(await resolveStore("no-such-shop.stores.example.com", "/")).toBeNull();
    expect(await resolveStore("unknown.example.org", "/")).toBeNull();
    expect(await resolveStore("sellify.example.com", "/")).toBeNull();
    expect(await resolveStore("sellify.example.com", `/s/${STORE_HOST_SEGMENT}`)).toBeNull();
  });
});

describe("isolation", () => {
  it("shop A's config never shows for shop B", async () => {
    const { shopA, shopB } = await seedTwoShops();
    await saveDraft(shopA.shopId, { content: { about: "Only for A" } });
    await publishStore(shopA.shopId, shopA.owner.userId);

    expect(await getStorefront(shopB.shopId, { preview: false })).toMatchObject({ status: "offline" });
    const previewB = await getStorefront(shopB.shopId, { preview: true, userId: shopB.owner.userId });
    expect(previewB.status === "live" && previewB.config.content.about).toBe("");
    expect(previewB.status === "live" && previewB.config.brand.name).toBe(shopB.name);

    const resolvedB = await resolveStore("sellify.example.com", `/s/${shopB.slug}`);
    expect(resolvedB?.shopId).toBe(shopB.shopId);
  });

  it("setStoreOnline and publishStore on A leave B unchanged", async () => {
    const { shopA, shopB } = await seedTwoShops();
    await publishStore(shopB.shopId, shopB.owner.userId);
    await publishStore(shopA.shopId, shopA.owner.userId);
    await setStoreOnline(shopA.shopId, false);

    expect((await getStorefront(shopB.shopId, { preview: false })).status).toBe("live");
    expect(await forShop(shopB.shopId).storeConfig.listVersions()).toHaveLength(1);
  });

  it("a custom domain belongs to exactly one shop", async () => {
    const { shopA, shopB } = await seedTwoShops();
    await forShop(shopA.shopId).customDomains.add({ hostname: "shared.ie", status: "verified" });

    await expect(forShop(shopB.shopId).customDomains.add({ hostname: "shared.ie" })).rejects.toThrow();
    expect(await forShop(shopB.shopId).customDomains.setStatus("shared.ie", "error")).toBe(false);
    expect(await forShop(shopB.shopId).customDomains.list()).toEqual([]);
    expect((await resolveStore("shared.ie", "/"))?.shopId).toBe(shopA.shopId);
  });
});
