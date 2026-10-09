import { describe, expect, it } from "vitest";
import { decrementStock, forShop, inTransaction } from "@/data";
import type { ProductInput } from "@/domain/product";
import { seedTwoShops } from "@/test/seed";
import { recordPosSale } from "./record-pos-sale";

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

describe("recordPosSale", () => {
  it("sells the last unit: stock is zero, the product reads as sold out, one sale is logged", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 1 }));

    const result = await recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 1 }]);

    expect(result.ok).toBe(true);
    expect((await repos.products.get(phone.id))?.stockQty).toBe(0);
    expect(await repos.products.list({ stock: "out" })).toHaveLength(1);
    expect(await repos.products.list({ stock: "in" })).toHaveLength(0);
    const sales = await repos.sales.list();
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({
      channel: "pos",
      status: "completed",
      total: 34900,
      items: [{ productId: phone.id, title: "iPhone 13", quantity: 1, unitPrice: 34900 }],
    });
    if (result.ok) expect(sales[0].id).toBe(result.value.saleId);
  });

  it("returns the saved total", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ price: 12345, stockQty: 3 }));

    const result = await recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 3 }]);

    expect(result).toEqual({ ok: true, value: { saleId: expect.any(String), total: 37035 } });
  });

  it("two concurrent sales over the same products in opposite order both complete", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const a = await repos.products.create(input({ title: "A", stockQty: 20 }));
    const b = await repos.products.create(input({ title: "B", stockQty: 20 }));

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        recordPosSale(
          shopA.shopId,
          i % 2 === 0
            ? [
                { productId: a.id, qty: 1 },
                { productId: b.id, qty: 1 },
              ]
            : [
                { productId: b.id, qty: 1 },
                { productId: a.id, qty: 1 },
              ],
        ),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    expect((await repos.products.get(a.id))?.stockQty).toBe(14);
    expect((await repos.products.get(b.id))?.stockQty).toBe(14);
  });

  it("prices the sale from the database and merges duplicate lines", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ price: 10000, stockQty: 5 }));
    const cable = await repos.products.create(
      input({ title: "Cable", kind: "accessory", price: 995, stockQty: 5 }),
    );

    const result = await recordPosSale(shopA.shopId, [
      { productId: phone.id, qty: 1 },
      { productId: cable.id, qty: 2 },
      { productId: phone.id, qty: 1 },
    ]);

    expect(result.ok).toBe(true);
    const [sale] = await repos.sales.list();
    expect(sale.total).toBe(2 * 10000 + 2 * 995);
    expect(sale.items).toHaveLength(2);
    expect((await repos.products.get(phone.id))?.stockQty).toBe(3);
    expect((await repos.products.get(cable.id))?.stockQty).toBe(3);
  });

  it("rejects overselling and leaves stock and sales unchanged, even for the lines that were in stock", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const plenty = await repos.products.create(input({ title: "Plenty", stockQty: 5 }));
    const scarce = await repos.products.create(input({ title: "Scarce", stockQty: 1 }));

    const result = await recordPosSale(shopA.shopId, [
      { productId: plenty.id, qty: 2 },
      { productId: scarce.id, qty: 2 },
    ]);

    expect(result).toEqual({ ok: false, error: { outOfStock: [scarce.id] } });
    expect((await repos.products.get(plenty.id))?.stockQty).toBe(5);
    expect((await repos.products.get(scarce.id))?.stockQty).toBe(1);
    expect(await repos.sales.list()).toEqual([]);
  });

  it("cannot be used to sell more than is left when two sales race for the last unit", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 1 }));

    const results = await Promise.all([
      recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 1 }]),
      recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 1 }]),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await repos.products.get(phone.id))?.stockQty).toBe(0);
    expect(await repos.sales.list()).toHaveLength(1);
  });

  it("rejects a quantity that is not a positive whole number without touching stock", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 3 }));

    for (const qty of [0, -1, 1.5]) {
      const result = await recordPosSale(shopA.shopId, [{ productId: phone.id, qty }]);
      expect(result.ok).toBe(false);
    }

    expect((await repos.products.get(phone.id))?.stockQty).toBe(3);
    expect(await repos.sales.list()).toEqual([]);
  });

  it("treats an archived product as out of stock", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 3 }));
    await repos.products.remove(phone.id);

    const result = await recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 1 }]);

    expect(result).toEqual({ ok: false, error: { outOfStock: [phone.id] } });
  });

  it("shop A's POS cannot sell or change shop B's products", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const productB = await forShop(shopB.shopId).products.create(input({ stockQty: 4 }));

    const result = await recordPosSale(shopA.shopId, [{ productId: productB.id, qty: 1 }]);

    expect(result).toEqual({ ok: false, error: { outOfStock: [productB.id] } });
    expect((await forShop(shopB.shopId).products.get(productB.id))?.stockQty).toBe(4);
    expect(await forShop(shopA.shopId).sales.list()).toEqual([]);
    expect(await forShop(shopB.shopId).sales.list()).toEqual([]);
  });

  it("keeps history readable after the product is archived or renamed", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ title: "Pixel 8", price: 20000, stockQty: 2 }));
    await recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 1 }]);

    await repos.products.update(phone.id, input({ title: "Renamed", price: 99900, stockQty: 1 }), 1);
    await repos.products.remove(phone.id);

    const [sale] = await repos.sales.list();
    expect(sale.items[0]).toMatchObject({ title: "Pixel 8", unitPrice: 20000 });
    expect(await repos.products.get(phone.id, { includeArchived: true })).not.toBeNull();
  });
});

describe("decrementStock", () => {
  it("reduces stock only while enough is left, and reports whether it did", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 2 }));

    const results = await inTransaction(async (tx) => [
      await decrementStock(tx, shopA.shopId, phone.id, 2),
      await decrementStock(tx, shopA.shopId, phone.id, 1),
    ]);

    expect(results).toEqual([true, false]);
    expect((await repos.products.get(phone.id))?.stockQty).toBe(0);
  });

  it("does nothing for another shop's product", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const productB = await forShop(shopB.shopId).products.create(input({ stockQty: 2 }));

    const done = await inTransaction((tx) => decrementStock(tx, shopA.shopId, productB.id, 1));

    expect(done).toBe(false);
    expect((await forShop(shopB.shopId).products.get(productB.id))?.stockQty).toBe(2);
  });
});

describe("sales.createOnline", () => {
  it("records an online sale once per Stripe session", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 2 }));
    const sale = {
      stripeSessionId: "cs_test_1",
      items: [{ productId: phone.id, title: "iPhone 13", quantity: 1, unitPrice: 34900 }],
    };

    const first = await inTransaction((tx) => repos.sales.createOnline(tx, sale));
    const again = await inTransaction((tx) => repos.sales.createOnline(tx, sale));

    expect(first).toEqual({ saleId: expect.any(String) });
    expect(again).toEqual({ duplicate: true });
    const sales = await repos.sales.list();
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ channel: "online", status: "completed", total: 34900 });
  });

  it("can flag a sale as needing a refund", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 0 }));

    await inTransaction(async (tx) => {
      const created = await repos.sales.createOnline(tx, {
        stripeSessionId: "cs_test_2",
        items: [{ productId: phone.id, title: "iPhone 13", quantity: 1, unitPrice: 34900 }],
      });
      if ("saleId" in created) await repos.sales.markNeedsRefund(tx, created.saleId);
    });

    expect((await repos.sales.list())[0].status).toBe("needs_refund");
  });
});

describe("sales.lockProducts", () => {
  it("hides archived products unless includeArchived is set, and never returns another shop's", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const live = await repos.products.create(input({ title: "Live" }));
    const gone = await repos.products.create(input({ title: "Gone", price: 500 }));
    await repos.products.remove(gone.id);
    const other = await forShop(shopB.shopId).products.create(input());
    const ids = [live.id, gone.id, other.id];

    const active = await inTransaction((tx) => repos.sales.lockProducts(tx, ids));
    const all = await inTransaction((tx) =>
      repos.sales.lockProducts(tx, ids, { includeArchived: true }),
    );

    expect(active.map((p) => p.id)).toEqual([live.id]);
    expect(all.map((p) => p.id).sort()).toEqual([live.id, gone.id].sort());
    expect(all.find((p) => p.id === gone.id)).toMatchObject({ title: "Gone", price: 500 });
  });
});

describe("sales.createOnline input", () => {
  it("rejects a sale with no items", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);

    await expect(
      inTransaction((tx) => repos.sales.createOnline(tx, { stripeSessionId: "cs_empty", items: [] })),
    ).rejects.toThrow();
    expect(await repos.sales.list()).toEqual([]);
  });
});

describe("sales.list date range", () => {
  it("returns only sales at or after since and before until", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 5 }));
    await recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 1 }]);
    const [first] = await repos.sales.list();
    await new Promise((r) => setTimeout(r, 20));
    const boundary = new Date();
    await new Promise((r) => setTimeout(r, 20));
    await recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 1 }]);

    expect(await repos.sales.list({ since: boundary })).toHaveLength(1);
    expect((await repos.sales.list({ until: boundary })).map((s) => s.id)).toEqual([first.id]);
    expect(await repos.sales.list({ since: first.createdAt })).toHaveLength(2);
    expect(await repos.sales.list({ since: boundary, until: boundary })).toEqual([]);
    expect(await repos.sales.list({ since: new Date(Date.now() + 60_000) })).toEqual([]);
  });
});

describe("sales.list", () => {
  it("lists newest first, filters by channel and status, and never shows another shop's sales", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input({ stockQty: 5 }));
    await recordPosSale(shopA.shopId, [{ productId: phone.id, qty: 1 }]);
    await inTransaction(async (tx) => {
      const created = await repos.sales.createOnline(tx, {
        stripeSessionId: "cs_test_3",
        items: [{ productId: phone.id, title: "iPhone 13", quantity: 1, unitPrice: 34900 }],
      });
      if ("saleId" in created) await repos.sales.markNeedsRefund(tx, created.saleId);
    });
    const productB = await forShop(shopB.shopId).products.create(input());
    await recordPosSale(shopB.shopId, [{ productId: productB.id, qty: 1 }]);

    const all = await repos.sales.list();
    expect(all.map((s) => s.channel)).toEqual(["online", "pos"]);
    expect((await repos.sales.list({ channel: "pos" })).map((s) => s.channel)).toEqual(["pos"]);
    expect((await repos.sales.list({ status: "needs_refund" })).map((s) => s.channel)).toEqual([
      "online",
    ]);
    expect(await repos.sales.list({ channel: "pos", status: "needs_refund" })).toEqual([]);
  });
});
