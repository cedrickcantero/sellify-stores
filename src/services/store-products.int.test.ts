import { describe, expect, it } from "vitest";
import { forShop } from "@/data";
import type { ProductInput } from "@/domain/product";
import { seedTwoShops } from "@/test/seed";
import { getStoreProduct, listStoreProducts } from "./store-products";

const input = (title: string, stockQty: number): ProductInput => ({
  title,
  kind: "phone",
  condition: "good",
  price: 19900,
  stockQty,
  images: [],
  deviceModelId: null,
});

describe("listStoreProducts", () => {
  it("reports a product sold out on the next call once its stock reaches zero", async () => {
    const { shopA } = await seedTwoShops();
    const products = forShop(shopA.shopId).products;
    const phone = await products.create(input("Pixel 7", 2));

    const before = await listStoreProducts(shopA.shopId);
    expect(before.find((p) => p.id === phone.id)).toMatchObject({ stockQty: 2, soldOut: false });

    // A sale in the physical shop sells the last two.
    expect(await products.update(phone.id, input("Pixel 7", 0), 2)).toMatchObject({ ok: true });

    const after = await listStoreProducts(shopA.shopId);
    expect(after.find((p) => p.id === phone.id)).toMatchObject({ stockQty: 0, soldOut: true });
  });

  it("lists only this shop's active products", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const mine = await forShop(shopA.shopId).products.create(input("Mine", 1));
    const archived = await forShop(shopA.shopId).products.create(input("Archived", 1));
    await forShop(shopB.shopId).products.create(input("Theirs", 1));
    await forShop(shopA.shopId).products.remove(archived.id);

    const listed = await listStoreProducts(shopA.shopId);
    expect(listed.map((p) => p.id)).toEqual([mine.id]);
  });
});

describe("getStoreProduct", () => {
  it("returns this shop's active product, never an archived or another shop's", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const mine = await forShop(shopA.shopId).products.create(input("Mine", 1));
    const archived = await forShop(shopA.shopId).products.create(input("Archived", 1));
    const theirs = await forShop(shopB.shopId).products.create(input("Theirs", 1));
    await forShop(shopA.shopId).products.remove(archived.id);

    expect(await getStoreProduct(shopA.shopId, mine.id)).toMatchObject({ id: mine.id, soldOut: false });
    expect(await getStoreProduct(shopA.shopId, archived.id)).toBeNull();
    expect(await getStoreProduct(shopA.shopId, theirs.id)).toBeNull();
  });
});
