import { beforeEach, describe, expect, it, vi } from "vitest";

// The session is the system boundary: the signed-in shop is set per test.
const active = { current: { shopId: "", userId: "" } };
vi.mock("@/auth/session", () => ({ getActiveShop: async () => active.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { saveStoreDetailsAction, setStoreOnlineAction } = await import("./actions");
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
