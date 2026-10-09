import { describe, expect, it } from "vitest";
import { forShop } from "@/data";
import { createFakeMailer } from "@/email";
import { encodeOrderMetadata, type OrderLine } from "@/domain/order-metadata";
import type { ProductInput } from "@/domain/product";
import type { PaidSession } from "@/payments/gateway";
import { seedTwoShops } from "@/test/seed";
import { fulfilOrder } from "./fulfil-order";
import { recordPosSale } from "./record-pos-sale";

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

function session(shopId: string, lines: OrderLine[], overrides: Partial<PaidSession> = {}): PaidSession {
  return {
    id: "cs_test_1",
    metadata: encodeOrderMetadata(shopId, lines),
    clientReferenceId: shopId,
    customerEmail: "buyer@example.com",
    paymentStatus: "paid",
    amountTotal: lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    ...overrides,
  };
}

async function shopWithTwoProducts(stock = 5) {
  const { shopA, shopB } = await seedTwoShops();
  const repos = forShop(shopA.shopId);
  const a = await repos.products.create(input({ title: "A", price: 10000, stockQty: stock }));
  const b = await repos.products.create(input({ title: "B", price: 2500, stockQty: stock }));
  return { shopA, shopB, repos, a, b };
}

describe("fulfilOrder", () => {
  it("records one online sale, takes the stock and sends the customer and shop emails", async () => {
    const { shopA, repos, a, b } = await shopWithTwoProducts();
    const mailer = createFakeMailer();

    const result = await fulfilOrder(
      session(shopA.shopId, [
        { productId: a.id, qty: 2, unitPrice: 10000 },
        { productId: b.id, qty: 1, unitPrice: 2500 },
      ]),
      { mailer },
    );

    const sales = await repos.sales.list();
    expect(sales).toHaveLength(1);
    expect(result).toEqual({ saleId: sales[0].id, status: "completed" });
    expect(sales[0]).toMatchObject({ channel: "online", status: "completed", total: 22500 });
    expect(sales[0].items.map((i) => [i.title, i.quantity, i.unitPrice]).sort()).toEqual([
      ["A", 2, 10000],
      ["B", 1, 2500],
    ]);
    expect((await repos.products.get(a.id))?.stockQty).toBe(3);
    expect((await repos.products.get(b.id))?.stockQty).toBe(4);

    const outbox = await repos.emailOutbox.list();
    expect(outbox.map((e) => e.kind).sort()).toEqual(["order_customer", "order_shop"]);
    const customer = outbox.find((e) => e.kind === "order_customer");
    expect(customer).toMatchObject({ recipient: "buyer@example.com", status: "sent" });
    expect(customer?.body).toContain("€225.00");
    expect(outbox.find((e) => e.kind === "order_shop")).toMatchObject({ recipient: shopA.owner.email, status: "sent" });
    expect(mailer.sent).toHaveLength(2);
  });

  it("a repeated session creates one sale, one decrement and no second email", async () => {
    const { shopA, repos, a } = await shopWithTwoProducts();
    const mailer = createFakeMailer();
    const paid = session(shopA.shopId, [{ productId: a.id, qty: 2, unitPrice: 10000 }]);

    const first = await fulfilOrder(paid, { mailer });
    const second = await fulfilOrder(paid, { mailer });

    expect(first).toMatchObject({ status: "completed" });
    expect(second).toEqual({ duplicate: true });
    expect(await repos.sales.list()).toHaveLength(1);
    expect((await repos.products.get(a.id))?.stockQty).toBe(3);
    expect(mailer.sent).toHaveLength(2);
  });

  it("concurrent duplicate deliveries create one sale and one decrement", async () => {
    const { shopA, repos, a, b } = await shopWithTwoProducts();
    const paid = session(shopA.shopId, [
      { productId: b.id, qty: 1, unitPrice: 2500 },
      { productId: a.id, qty: 1, unitPrice: 10000 },
    ]);

    const results = await Promise.all(Array.from({ length: 4 }, () => fulfilOrder(paid, { mailer: createFakeMailer() })));

    expect(results.filter((r) => "duplicate" in r)).toHaveLength(3);
    expect(await repos.sales.list()).toHaveLength(1);
    expect((await repos.products.get(a.id))?.stockQty).toBe(4);
    expect((await repos.products.get(b.id))?.stockQty).toBe(4);
  });

  it("flags needs_refund when stock ran out, leaves stock at zero and sends the issue email", async () => {
    const { shopA, repos, a, b } = await shopWithTwoProducts(1);
    await recordPosSale(shopA.shopId, [{ productId: a.id, qty: 1 }]);
    const mailer = createFakeMailer();

    const result = await fulfilOrder(
      session(shopA.shopId, [
        { productId: b.id, qty: 1, unitPrice: 2500 },
        { productId: a.id, qty: 1, unitPrice: 10000 },
      ]),
      { mailer },
    );

    expect(result).toMatchObject({ status: "needs_refund" });
    const [online] = await repos.sales.list({ channel: "online" });
    expect(online).toMatchObject({ status: "needs_refund", total: 12500 });
    expect((await repos.products.get(a.id))?.stockQty).toBe(0);
    // The other line is put back: the whole order is refunded.
    expect((await repos.products.get(b.id))?.stockQty).toBe(1);

    const outbox = await repos.emailOutbox.list();
    expect(outbox.map((e) => e.kind).sort()).toEqual(["order_issue_customer", "order_shop"]);
    expect(outbox.find((e) => e.kind === "order_shop")?.body).toMatch(/refund/i);
    expect(outbox.find((e) => e.kind === "order_issue_customer")?.recipient).toBe("buyer@example.com");
  });

  it("still fulfils when a product was archived while the customer paid", async () => {
    const { shopA, repos, a } = await shopWithTwoProducts();
    await repos.products.remove(a.id);

    const result = await fulfilOrder(session(shopA.shopId, [{ productId: a.id, qty: 1, unitPrice: 10000 }]), {
      mailer: createFakeMailer(),
    });

    // Archived products cannot be decremented, so the order needs a refund.
    expect(result).toMatchObject({ status: "needs_refund" });
    expect((await repos.sales.list())[0].items[0].title).toBe("A");
  });

  it("sends the shop email even when the customer left no email, and survives mail failure", async () => {
    const { shopA, repos, a } = await shopWithTwoProducts();

    const result = await fulfilOrder(
      session(shopA.shopId, [{ productId: a.id, qty: 1, unitPrice: 10000 }], { customerEmail: null }),
      { mailer: createFakeMailer({ fail: true }) },
    );

    expect(result).toMatchObject({ status: "completed" });
    const outbox = await repos.emailOutbox.list();
    expect(outbox.map((e) => e.kind)).toEqual(["order_shop"]);
    expect(outbox[0].status).toBe("failed");
  });

  it("escapes product titles in the emails", async () => {
    const { shopA, repos } = await shopWithTwoProducts();
    const evil = await repos.products.create(input({ title: "<script>x</script>" }));
    await fulfilOrder(session(shopA.shopId, [{ productId: evil.id, qty: 1, unitPrice: 34900 }]), {
      mailer: createFakeMailer(),
    });
    const bodies = (await repos.emailOutbox.list()).map((e) => e.body).join("");
    expect(bodies).not.toContain("<script>");
    expect(bodies).toContain("&lt;script&gt;");
  });

  it("refuses an order whose products belong to another shop, creating nothing", async () => {
    const { shopA, shopB, a } = await shopWithTwoProducts();
    await expect(
      fulfilOrder(session(shopB.shopId, [{ productId: a.id, qty: 1, unitPrice: 10000 }]), { mailer: createFakeMailer() }),
    ).rejects.toThrow(/invalid order/i);
    expect(await forShop(shopB.shopId).sales.list()).toHaveLength(0);
    expect((await forShop(shopA.shopId).products.get(a.id))?.stockQty).toBe(5);
  });

  it.each([
    ["metadata this app did not create", (s: PaidSession) => ({ ...s, metadata: {} })],
    ["a client reference for another shop", (s: PaidSession) => ({ ...s, clientReferenceId: "other-shop" })],
    ["a total that does not match the lines", (s: PaidSession) => ({ ...s, amountTotal: 1 })],
    ["a session that was not paid", (s: PaidSession) => ({ ...s, paymentStatus: "unpaid" as const })],
  ])("refuses %s", async (_name, change) => {
    const { shopA, repos, a } = await shopWithTwoProducts();
    const paid = session(shopA.shopId, [{ productId: a.id, qty: 1, unitPrice: 10000 }]);
    await expect(fulfilOrder(change(paid), { mailer: createFakeMailer() })).rejects.toThrow(/invalid order/i);
    expect(await repos.sales.list()).toHaveLength(0);
    expect((await repos.products.get(a.id))?.stockQty).toBe(5);
  });

  it("concurrent POS sales and fulfilments over the same products in opposite order never deadlock", async () => {
    const { shopA, repos, a, b } = await shopWithTwoProducts(40);

    const runs = Array.from({ length: 6 }, (_, i) => {
      const forward = i % 2 === 0;
      const lines = forward
        ? [{ productId: a.id, qty: 1, unitPrice: 10000 }, { productId: b.id, qty: 1, unitPrice: 2500 }]
        : [{ productId: b.id, qty: 1, unitPrice: 2500 }, { productId: a.id, qty: 1, unitPrice: 10000 }];
      return i % 3 === 0
        ? recordPosSale(shopA.shopId, lines.map((l) => ({ productId: l.productId, qty: l.qty })))
        : fulfilOrder(session(shopA.shopId, lines, { id: `cs_test_${i}` }), { mailer: createFakeMailer() });
    });
    const results = await Promise.all(runs);

    expect(results.every((r) => ("ok" in r ? r.ok : !("duplicate" in r) && r.status === "completed"))).toBe(true);
    expect((await repos.products.get(a.id))?.stockQty).toBe(34);
    expect((await repos.products.get(b.id))?.stockQty).toBe(34);
    expect(await repos.sales.list()).toHaveLength(6);
  });
});
