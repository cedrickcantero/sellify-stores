import { describe, expect, it } from "vitest";
import { forShop } from "@/data";
import type { ProductInput } from "@/domain/product";
import { decodeOrderMetadata } from "@/domain/order-metadata";
import { createFakeGateway } from "@/test/fake-gateway";
import { seedTwoShops } from "@/test/seed";
import { createCheckout } from "./checkout";

const input = (overrides: Partial<ProductInput> = {}): ProductInput => ({
  title: "iPhone 13",
  kind: "phone",
  condition: "good",
  price: 34900,
  stockQty: 3,
  images: [],
  deviceModelId: null,
  ...overrides,
});
const urls = { success: "https://x.test/s/a/checkout/success", cancel: "https://x.test/s/a/basket" };

describe("createCheckout", () => {
  it("prices every line from the database and puts shop and lines in the session", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(input());
    const case_ = await repos.products.create(input({ title: "Case", price: 1500 }));
    const gateway = createFakeGateway();

    const result = await createCheckout(
      shopA.shopId,
      // A forged client line also carries a price: it must be ignored.
      [{ productId: phone.id, qty: 2, price: 1 } as never, { productId: case_.id, qty: 1 }],
      urls,
      { gateway },
    );

    expect(result).toEqual({ ok: true, value: { url: expect.stringContaining("checkout.example.test") } });
    const session = gateway.created[0];
    expect(session.lines).toEqual([
      { name: "iPhone 13", unitAmount: 34900, quantity: 2 },
      { name: "Case", unitAmount: 1500, quantity: 1 },
    ]);
    expect(session.clientReferenceId).toBe(shopA.shopId);
    expect(decodeOrderMetadata(session.metadata)).toEqual({
      ok: true,
      value: {
        shopId: shopA.shopId,
        lines: [
          { productId: phone.id, qty: 2, unitPrice: 34900 },
          { productId: case_.id, qty: 1, unitPrice: 1500 },
        ],
      },
    });
    expect(session.successUrl).toBe(`${urls.success}?session_id={CHECKOUT_SESSION_ID}`);
    expect(session.cancelUrl).toBe(urls.cancel);
    // Checkout takes no stock; fulfilment does.
    expect((await repos.products.get(phone.id))?.stockQty).toBe(3);
  });

  it("keeps ?preview on the success url and joins session_id with &", async () => {
    const { shopA } = await seedTwoShops();
    const phone = await forShop(shopA.shopId).products.create(input());
    const gateway = createFakeGateway();
    await createCheckout(shopA.shopId, [{ productId: phone.id, qty: 1 }], { success: `${urls.success}?preview`, cancel: urls.cancel }, { gateway });
    expect(gateway.created[0].successUrl).toBe(`${urls.success}?preview&session_id={CHECKOUT_SESSION_ID}`);
  });

  it("rejects out-of-stock, archived and other-shop lines, names them and creates no session", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const ok = await repos.products.create(input());
    const low = await repos.products.create(input({ title: "Low", stockQty: 1 }));
    const gone = await repos.products.create(input({ title: "Gone" }));
    await repos.products.remove(gone.id);
    const foreign = await forShop(shopB.shopId).products.create(input({ title: "Theirs" }));
    const gateway = createFakeGateway();

    const result = await createCheckout(
      shopA.shopId,
      [
        { productId: ok.id, qty: 1 },
        { productId: low.id, qty: 2 },
        { productId: gone.id, qty: 1 },
        { productId: foreign.id, qty: 1 },
      ],
      urls,
      { gateway },
    );

    expect(result).toEqual({ ok: false, error: { outOfStock: [low.id, gone.id, foreign.id] } });
    expect(gateway.created).toHaveLength(0);
  });

  it("refuses an empty basket", async () => {
    const { shopA } = await seedTwoShops();
    const gateway = createFakeGateway();
    expect(await createCheckout(shopA.shopId, [], urls, { gateway })).toEqual({ ok: false, error: { outOfStock: [] } });
    expect(gateway.created).toHaveLength(0);
  });
});
