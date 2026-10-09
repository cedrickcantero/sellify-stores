import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceCatalog, forShop, inTransaction } from "@/data";
import type { ProductInput } from "@/domain/product";
import { seedTwoShops } from "@/test/seed";
import { backdateSale } from "@/test/sales";
import { getDashboardSummary } from "./dashboard";
import { recordPosSale } from "./record-pos-sale";
import { publishStore } from "./store";

afterEach(() => {
  vi.unstubAllEnvs();
});

const CUSTOMER = {
  name: "Niamh Walsh",
  phone: "0851234567",
  email: "niamh@example.com",
};

function product(price: number): ProductInput {
  return {
    title: "iPhone 13",
    kind: "phone",
    condition: "good",
    price,
    stockQty: 50,
    images: [],
    deviceModelId: null,
  };
}

async function sell(shopId: string, price: number, qty = 1) {
  const phone = await forShop(shopId).products.create(product(price));
  const result = await recordPosSale(shopId, [{ productId: phone.id, qty }]);
  if (!result.ok) throw new Error("sale failed");
  return result.value;
}

async function createdAt(shopId: string, saleId: string): Promise<Date> {
  const sale = (await forShop(shopId).sales.list()).find((s) => s.id === saleId);
  if (!sale) throw new Error("no sale");
  return sale.createdAt;
}

describe("getDashboardSummary: sales today", () => {
  it("counts and totals only this shop's sales from today", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const first = await sell(shopA.shopId, 10000, 2);
    await sell(shopA.shopId, 2500);
    await sell(shopB.shopId, 99900);
    const now = await createdAt(shopA.shopId, first.saleId);

    const summary = await getDashboardSummary(shopA.shopId, { now });

    expect(summary.salesToday).toEqual({ count: 2, total: 22500 });
  });

  it("leaves out sales from another day in the shop's timezone", async () => {
    const { shopA } = await seedTwoShops();
    const sale = await sell(shopA.shopId, 10000);
    const saleTime = await createdAt(shopA.shopId, sale.saleId);

    const twoDaysLater = new Date(saleTime.getTime() + 2 * 24 * 60 * 60 * 1000);
    expect((await getDashboardSummary(shopA.shopId, { now: twoDaysLater })).salesToday).toEqual({
      count: 0,
      total: 0,
    });
    const twoDaysEarlier = new Date(saleTime.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(
      (await getDashboardSummary(shopA.shopId, { now: twoDaysEarlier })).salesToday.count,
    ).toBe(0);
  });

  it("counts every sale of the day, not just the newest 200", async () => {
    const { shopA } = await seedTwoShops();
    const repos = forShop(shopA.shopId);
    const phone = await repos.products.create(product(100));
    const line = {
      productId: phone.id,
      title: "iPhone 13",
      quantity: 1,
      unitPrice: 100,
    };
    await Promise.all(
      Array.from({ length: 201 }, () => inTransaction((tx) => repos.sales.createPos(tx, [line]))),
    );

    const summary = await getDashboardSummary(shopA.shopId);

    expect(summary.salesToday).toEqual({ count: 201, total: 20100 });
  });

  it("leaves out sales flagged as needing a refund", async () => {
    const { shopA } = await seedTwoShops();
    const paid = await sell(shopA.shopId, 10000);
    const refund = await sell(shopA.shopId, 5000);
    await inTransaction((tx) => forShop(shopA.shopId).sales.markNeedsRefund(tx, refund.saleId));
    const now = await createdAt(shopA.shopId, paid.saleId);

    expect((await getDashboardSummary(shopA.shopId, { now })).salesToday).toEqual({
      count: 1,
      total: 10000,
    });
  });

  it("uses the shop's timezone: 23:30Z in a summer Dublin shop is the next local day", async () => {
    const { shopA } = await seedTwoShops();
    const sale = await sell(shopA.shopId, 10000);
    await backdateSale(sale.saleId, new Date("2030-07-10T23:30:00Z"));

    const sameUtcDay = await getDashboardSummary(shopA.shopId, {
      now: new Date("2030-07-10T10:00:00Z"),
    });
    const nextLocalDay = await getDashboardSummary(shopA.shopId, {
      now: new Date("2030-07-11T10:00:00Z"),
    });

    expect(sameUtcDay.salesToday.count).toBe(0);
    expect(nextLocalDay.salesToday).toEqual({ count: 1, total: 10000 });
  });

  it("is zero for a shop with no sales", async () => {
    const { shopA } = await seedTwoShops();
    expect((await getDashboardSummary(shopA.shopId)).salesToday).toEqual({
      count: 0,
      total: 0,
    });
  });
});

async function repairPrice(shopId: string) {
  const model = (await deviceCatalog.list())[0];
  const repairs = forShop(shopId).repairs;
  const type = await repairs.createType("Screen");
  return repairs.upsertPrice({
    deviceModelId: model.id,
    repairTypeId: type.id,
    price: 8900,
    partQty: 1,
  });
}

async function book(shopId: string, repairPriceId: string, slotStart: Date, name: string) {
  return inTransaction((tx) =>
    forShop(shopId).repairs.insertTicket(tx, {
      repairPriceId,
      slotStart,
      capacity: 2,
      source: "online",
      customerName: name,
      customerPhone: CUSTOMER.phone,
      customerEmail: CUSTOMER.email,
    }),
  );
}

describe("getDashboardSummary: upcoming repairs", () => {
  it("lists the shop's next booked tickets, soonest first, without past or cancelled ones", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const now = new Date("2030-06-10T12:00:00Z");
    const price = await repairPrice(shopA.shopId);
    const priceB = await repairPrice(shopB.shopId);
    await book(shopA.shopId, price.id, new Date("2030-06-11T10:00:00Z"), "Later");
    await book(shopA.shopId, price.id, new Date("2030-06-10T15:00:00Z"), "Sooner");
    await book(shopA.shopId, price.id, new Date("2030-06-09T10:00:00Z"), "Past");
    const cancelled = await book(
      shopA.shopId,
      price.id,
      new Date("2030-06-12T10:00:00Z"),
      "Cancelled",
    );
    await forShop(shopA.shopId).repairs.setTicketStatus(cancelled.id, "cancelled");
    await book(shopB.shopId, priceB.id, new Date("2030-06-10T16:00:00Z"), "Other shop");

    const summary = await getDashboardSummary(shopA.shopId, { now });

    expect(summary.upcomingRepairs.map((t) => t.customerName)).toEqual(["Sooner", "Later"]);
    expect(summary.upcomingRepairCount).toBe(2);
  });

  it("shows at most five tickets", async () => {
    const { shopA } = await seedTwoShops();
    const price = await repairPrice(shopA.shopId);
    for (let day = 11; day <= 17; day++) {
      await book(shopA.shopId, price.id, new Date(`2030-06-${day}T10:00:00Z`), `Customer ${day}`);
    }
    const summary = await getDashboardSummary(shopA.shopId, {
      now: new Date("2030-06-10T12:00:00Z"),
    });
    expect(summary.upcomingRepairs).toHaveLength(5);
    expect(summary.upcomingRepairCount).toBe(7);
    expect(summary.upcomingRepairs[0].customerName).toBe("Customer 11");
  });
});

async function quote(shopId: string, offer: number) {
  const model = (await deviceCatalog.list())[0];
  return forShop(shopId).buybacks.insertQuote({
    deviceModelId: model.id,
    storage: "128GB",
    answers: { screen_cracked: false, battery_ok: true, powers_on: true },
    offer,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
}

describe("getDashboardSummary: pending buybacks", () => {
  it("lists accepted quotes not yet received, for this shop only", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const buybacks = forShop(shopA.shopId).buybacks;
    const waiting = await quote(shopA.shopId, 20000);
    const received = await quote(shopA.shopId, 21000);
    await quote(shopA.shopId, 22000); // still only quoted
    const other = await quote(shopB.shopId, 23000);
    await buybacks.acceptQuote(waiting.id, CUSTOMER);
    await buybacks.acceptQuote(received.id, CUSTOMER);
    await buybacks.markReceived(received.id);
    await forShop(shopB.shopId).buybacks.acceptQuote(other.id, CUSTOMER);

    const summary = await getDashboardSummary(shopA.shopId);

    expect(summary.pendingBuybacks.map((q) => q.id)).toEqual([waiting.id]);
    expect(summary.pendingBuybackCount).toBe(1);
  });

  it("counts every accepted quote but lists only the newest five", async () => {
    const { shopA } = await seedTwoShops();
    for (let i = 0; i < 6; i++) {
      const q = await quote(shopA.shopId, 20000 + i);
      await forShop(shopA.shopId).buybacks.acceptQuote(q.id, CUSTOMER);
    }

    const summary = await getDashboardSummary(shopA.shopId);

    expect(summary.pendingBuybackCount).toBe(6);
    expect(summary.pendingBuybacks).toHaveLength(5);
  });
});

describe("getDashboardSummary: store status", () => {
  it("is offline with no address before the store is published", async () => {
    const { shopA } = await seedTwoShops();
    const summary = await getDashboardSummary(shopA.shopId, {
      origin: "https://app.example.com",
    });
    expect(summary.store).toEqual({ online: false, published: false, address: null });
  });

  it("is online with the path address once published", async () => {
    const { shopA } = await seedTwoShops();
    vi.stubEnv("STORE_ROOT_DOMAIN", "");
    await publishStore(shopA.shopId, shopA.owner.userId);

    const summary = await getDashboardSummary(shopA.shopId, {
      origin: "https://app.example.com",
    });

    expect(summary.store).toEqual({
      online: true,
      published: true,
      address: `https://app.example.com/s/${shopA.slug}`,
    });
  });

  it("has no address when the store is online but no origin or root domain is known", async () => {
    const { shopA } = await seedTwoShops();
    vi.stubEnv("STORE_ROOT_DOMAIN", "");
    await publishStore(shopA.shopId, shopA.owner.userId);
    expect((await getDashboardSummary(shopA.shopId)).store).toEqual({
      online: true,
      published: true,
      address: null,
    });
  });

  it("uses the store subdomain when a store root domain is set", async () => {
    const { shopA } = await seedTwoShops();
    vi.stubEnv("STORE_ROOT_DOMAIN", "stores.example.com");
    await publishStore(shopA.shopId, shopA.owner.userId);

    const summary = await getDashboardSummary(shopA.shopId, {
      origin: "https://app.example.com",
    });

    expect(summary.store.address).toBe(`https://${shopA.slug}.stores.example.com`);
  });

  it("goes offline again when the owner switches the store off", async () => {
    const { shopA } = await seedTwoShops();
    await publishStore(shopA.shopId, shopA.owner.userId);
    await forShop(shopA.shopId).storeConfig.setOnline(
      false,
      (await forShop(shopA.shopId).storeConfig.get())!.draft,
    );
    const summary = await getDashboardSummary(shopA.shopId, {
      origin: "https://app.example.com",
    });
    expect(summary.store).toEqual({ online: false, published: true, address: null });
  });
});
