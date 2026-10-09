import { beforeEach, describe, expect, it, vi } from "vitest";

// The session is the system boundary: the signed-in shop is set per test.
const active = { current: { shopId: "", userId: "" } };
vi.mock("@/auth/session", () => ({ getActiveShop: async () => active.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { saveDraftAction, saveStoreDetailsAction, setStoreOnlineAction } = await import("./actions");
const { getStoreSettings, publishStore } = await import("@/services/store");
const { seedTwoShops } = await import("@/test/seed");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_abc123_secretpart");
});

describe("saveStoreDetailsAction", () => {
  it("saves the name to the draft", async () => {
    const { shopA } = await seedTwoShops();
    active.current = { shopId: shopA.shopId, userId: shopA.owner.userId };

    const result = await saveStoreDetailsAction({}, form({ name: "  FixIt Online " }));
    expect(result.message).toBeDefined();
    expect((await getStoreSettings(shopA.shopId)).draft.brand.name).toBe("FixIt Online");
  });

  it("keeps what was typed and names the field when the name is empty", async () => {
    const { shopA } = await seedTwoShops();
    active.current = { shopId: shopA.shopId, userId: shopA.owner.userId };

    expect(await saveStoreDetailsAction({}, form({ name: "   " }))).toEqual({
      values: { name: "   " },
      errors: { "brand.name": "Enter a store name." },
    });
  });

  it("refuses a logo URL that is not this shop's upload", async () => {
    const { shopA } = await seedTwoShops();
    active.current = { shopId: shopA.shopId, userId: shopA.owner.userId };

    const result = await saveStoreDetailsAction(
      {},
      form({ name: "FixIt", logoUrl: "https://evil.example/logo.svg" }),
    );
    expect(result.errors).toEqual({ "brand.logoUrl": "Upload the logo again." });
    expect((await getStoreSettings(shopA.shopId)).draft.brand.logoUrl).toBeUndefined();
  });
});

describe("saveDraftAction", () => {
  it("saves a patch to the signed-in shop's draft and reports unpublished changes", async () => {
    const { shopA, shopB } = await seedTwoShops();
    active.current = { shopId: shopA.shopId, userId: shopA.owner.userId };
    await publishStore(shopA.shopId, shopA.owner.userId);

    expect(await saveDraftAction({ content: { about: "We fix phones." } })).toEqual({
      ok: true,
      unpublishedChanges: true,
    });
    expect((await getStoreSettings(shopA.shopId)).draft.content.about).toBe("We fix phones.");
    expect((await getStoreSettings(shopB.shopId)).draft.content.about).toBe("");
  });

  it("returns the field errors for an invalid value and saves nothing", async () => {
    const { shopA } = await seedTwoShops();
    active.current = { shopId: shopA.shopId, userId: shopA.owner.userId };

    expect(await saveDraftAction({ brand: { colors: { primary: "teal" } } })).toEqual({
      ok: false,
      errors: { "brand.colors.primary": "Enter a colour like #0F766E." },
    });
    expect((await getStoreSettings(shopA.shopId)).draft.brand.colors.primary).toBe("#1f2937");
  });

  it("refuses a patch with keys the config does not have", async () => {
    const { shopA } = await seedTwoShops();
    active.current = { shopId: shopA.shopId, userId: shopA.owner.userId };

    expect(await saveDraftAction({ shopId: "someone-else" })).toEqual({
      ok: false,
      errors: { config: "Could not save that change. Reload the page and try again." },
    });
  });

  it("keeps autosaving other fields when the draft already has a logo", async () => {
    const { shopA } = await seedTwoShops();
    active.current = { shopId: shopA.shopId, userId: shopA.owner.userId };
    const logoUrl = `https://abc123.public.blob.vercel-storage.com/images/${shopA.shopId}/0b7c9a2e.svg`;
    expect(await saveDraftAction({ brand: { logoUrl } })).toMatchObject({ ok: true });

    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_zzz999_secretpart");
    expect(await saveDraftAction({ contact: { phone: "091 123456" } })).toMatchObject({ ok: true });
  });
});

describe("setStoreOnlineAction", () => {
  it("accepts only a boolean", async () => {
    const { shopA } = await seedTwoShops();
    active.current = { shopId: shopA.shopId, userId: shopA.owner.userId };
    await publishStore(shopA.shopId, shopA.owner.userId);

    expect(await setStoreOnlineAction("false")).toEqual({ ok: false });
    expect((await getStoreSettings(shopA.shopId)).online).toBe(true);

    expect(await setStoreOnlineAction(false)).toEqual({ ok: true });
    expect((await getStoreSettings(shopA.shopId)).online).toBe(false);
  });
});
