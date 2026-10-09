import { describe, expect, it } from "vitest";
import type { ProductInput } from "@/domain/product";
import { seedTwoShops } from "@/test/seed";
import { deviceCatalog, forShop } from "./index";

function input(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    title: "iPhone 13",
    kind: "phone",
    condition: "good",
    price: 34900,
    stockQty: 2,
    images: [],
    deviceModelId: null,
    ...overrides,
  };
}

describe("products repository", () => {
  it("creates, gets and lists a product", async () => {
    const { shopA } = await seedTwoShops();
    const products = forShop(shopA.shopId).products;

    const created = await products.create(input({ images: ["https://blob.example.com/a.png"] }));

    expect(created).toMatchObject({
      shopId: shopA.shopId,
      title: "iPhone 13",
      kind: "phone",
      condition: "good",
      price: 34900,
      stockQty: 2,
      images: ["https://blob.example.com/a.png"],
    });
    expect(created.deviceModelId).toBeUndefined();
    expect(await products.get(created.id)).toEqual(created);
    expect(await products.list()).toEqual([created]);
  });

  it("links a product to a catalog device model", async () => {
    const { shopA } = await seedTwoShops();
    const products = forShop(shopA.shopId).products;

    const [model] = await deviceCatalog.list();

    const created = await products.create(input({ deviceModelId: model.id }));

    expect(created.deviceModelId).toBe(model.id);
    expect((await products.get(created.id))?.deviceModelId).toBe(model.id);
    await expect(products.create(input({ deviceModelId: "no-such-model" }))).rejects.toThrow();
  });

  it("filters by kind, condition and stock status", async () => {
    const { shopA } = await seedTwoShops();
    const products = forShop(shopA.shopId).products;
    const phone = await products.create(input({ title: "Phone", stockQty: 1 }));
    const caseNew = await products.create(
      input({ title: "Case", kind: "accessory", condition: "new", stockQty: 0 }),
    );

    expect((await products.list({ kind: "phone" })).map((p) => p.id)).toEqual([phone.id]);
    expect((await products.list({ kind: "accessory" })).map((p) => p.id)).toEqual([caseNew.id]);
    expect((await products.list({ condition: "new" })).map((p) => p.id)).toEqual([caseNew.id]);
    expect((await products.list({ stock: "in" })).map((p) => p.id)).toEqual([phone.id]);
    expect((await products.list({ stock: "out" })).map((p) => p.id)).toEqual([caseNew.id]);
    expect(await products.list({ kind: "phone", stock: "out" })).toEqual([]);
  });

  it("updates and removes a product", async () => {
    const { shopA } = await seedTwoShops();
    const products = forShop(shopA.shopId).products;
    const created = await products.create(input());

    const updated = await products.update(
      created.id,
      input({ title: "iPhone 13 Pro", stockQty: 0 }),
      created.stockQty,
    );
    expect(updated).toMatchObject({
      ok: true,
      product: { id: created.id, title: "iPhone 13 Pro", stockQty: 0 },
    });

    expect(await products.remove(created.id)).toBe(true);
    expect(await products.remove(created.id)).toBe(false);
  });

  it("refuses an edit saved against stale stock and leaves the stock unchanged", async () => {
    const { shopA } = await seedTwoShops();
    const products = forShop(shopA.shopId).products;
    const created = await products.create(input({ stockQty: 5 }));

    // The owner opens the form (stock 5); a sale elsewhere takes stock to 4.
    await products.update(created.id, input({ stockQty: 4 }), 5);

    const stale = await products.update(created.id, input({ title: "Edited", stockQty: 5 }), 5);

    expect(stale).toEqual({ ok: false, reason: "stock_changed" });
    expect(await products.get(created.id)).toMatchObject({ title: "iPhone 13", stockQty: 4 });
  });

  it("reports a missing product as not found", async () => {
    const { shopA } = await seedTwoShops();
    const result = await forShop(shopA.shopId).products.update("no-such-id", input(), 1);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("archives instead of deleting: gone from list and get, row kept", async () => {
    const { shopA } = await seedTwoShops();
    const products = forShop(shopA.shopId).products;
    const created = await products.create(input());

    expect(await products.remove(created.id)).toBe(true);

    expect(await products.list()).toEqual([]);
    expect(await products.get(created.id)).toBeNull();
    expect(await products.get(created.id, { includeArchived: true })).toMatchObject({
      id: created.id,
    });
    expect(await products.update(created.id, input(), 2)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("stores the new conditions", async () => {
    const { shopA } = await seedTwoShops();
    const products = forShop(shopA.shopId).products;
    const refurbished = await products.create(input({ condition: "refurbished" }));
    const used = await products.create(input({ condition: "used" }));

    expect((await products.list({ condition: "refurbished" })).map((p) => p.id)).toEqual([
      refurbished.id,
    ]);
    expect((await products.list({ condition: "used" })).map((p) => p.id)).toEqual([used.id]);
  });

  it("refuses a negative stock quantity at the database", async () => {
    const { shopA } = await seedTwoShops();
    await expect(forShop(shopA.shopId).products.create(input({ stockQty: -1 }))).rejects.toThrow();
  });

  it("never returns or changes another shop's products", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const a = forShop(shopA.shopId).products;
    const b = forShop(shopB.shopId).products;
    const theirs = await b.create(input({ title: "Shop B phone" }));
    const mine = await a.create(input({ title: "Shop A phone" }));

    expect((await a.list()).map((p) => p.id)).toEqual([mine.id]);
    expect(await a.get(theirs.id)).toBeNull();
    expect(await a.update(theirs.id, input({ title: "Hijacked" }), theirs.stockQty)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await a.get(theirs.id, { includeArchived: true })).toBeNull();
    expect(await a.remove(theirs.id)).toBe(false);

    expect(await b.get(theirs.id)).toMatchObject({ title: "Shop B phone" });
  });
});
