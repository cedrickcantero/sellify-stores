import { describe, expect, it } from "vitest";
import { seedTwoShops } from "@/test/seed";
import { deviceCatalog, forShop, resolveShopBySlug } from "./index";

describe("tenant isolation", () => {
  it("forShop(A).shop.get() returns shop A and never shop B", async () => {
    const { shopA, shopB } = await seedTwoShops();

    const fromA = await forShop(shopA.shopId).shop.get();
    const fromB = await forShop(shopB.shopId).shop.get();

    expect(fromA?.id).toBe(shopA.shopId);
    expect(fromA?.name).toBe(shopA.name);
    expect(fromB?.id).toBe(shopB.shopId);
    expect(fromA?.id).not.toBe(shopB.shopId);
  });

  it("forShop with an unknown id returns no shop", async () => {
    await seedTwoShops();
    expect(await forShop("no-such-shop").shop.get()).toBeNull();
  });

  it("resolveShopBySlug finds the matching shop or none", async () => {
    const { shopA, shopB } = await seedTwoShops();

    expect(await resolveShopBySlug(shopA.slug)).toEqual({ shopId: shopA.shopId });
    expect(await resolveShopBySlug(shopB.slug)).toEqual({ shopId: shopB.shopId });
    expect(await resolveShopBySlug("no-such-slug")).toBeNull();
  });
});

describe("deviceCatalog", () => {
  it("lists the seeded Apple, Samsung and Google models with storage options", async () => {
    const models = await deviceCatalog.list();

    expect(models.length).toBeGreaterThanOrEqual(30);
    expect(new Set(models.map((m) => m.brand))).toEqual(new Set(["Apple", "Samsung", "Google"]));
    expect(models.find((m) => m.name === "iPhone 13")).toMatchObject({
      brand: "Apple",
      storageOptions: ["128GB", "256GB", "512GB"],
    });
  });
});
