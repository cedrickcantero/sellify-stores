import { describe, expect, it } from "vitest";
import { seedTwoShops } from "@/test/seed";
import { deviceCatalog, forShop } from "../index";

const IN_AN_HOUR = () => new Date(Date.now() + 60 * 60 * 1000);
const CUSTOMER = { name: "Niamh Walsh", phone: "0851234567", email: "niamh@example.com" };

async function model(name: string) {
  const found = (await deviceCatalog.list()).find((m) => m.name === name);
  if (!found) throw new Error(`Missing ${name} in the device catalog`);
  return found;
}

async function quoteFor(shopId: string, offer = 25000) {
  const iphone = await model("iPhone 13");
  return forShop(shopId).buybacks.insertQuote({
    deviceModelId: iphone.id,
    storage: "128GB",
    answers: { screen_cracked: false, battery_ok: true, powers_on: true },
    offer,
    expiresAt: IN_AN_HOUR(),
  });
}

describe("buyback base prices", () => {
  it("upserts one price per model and storage and reads it back", async () => {
    const { shopA } = await seedTwoShops();
    const iphone = await model("iPhone 13");
    const buybacks = forShop(shopA.shopId).buybacks;

    expect(await buybacks.getBasePrice(iphone.id, "128GB")).toBeNull();

    await buybacks.upsertBasePrice({ deviceModelId: iphone.id, storage: "128GB", basePrice: 30000 });
    await buybacks.upsertBasePrice({ deviceModelId: iphone.id, storage: "128GB", basePrice: 32000 });
    await buybacks.upsertBasePrice({ deviceModelId: iphone.id, storage: "256GB", basePrice: 36000 });

    expect(await buybacks.getBasePrice(iphone.id, "128GB")).toBe(32000);
    expect(await buybacks.getBasePrice(iphone.id, "256GB")).toBe(36000);
    expect(await buybacks.getBasePrice(iphone.id, "512GB")).toBeNull();
    expect(await buybacks.listBasePrices()).toHaveLength(2);
  });

  it("keeps base prices separate per shop", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const iphone = await model("iPhone 13");

    await forShop(shopA.shopId).buybacks.upsertBasePrice({
      deviceModelId: iphone.id,
      storage: "128GB",
      basePrice: 30000,
    });
    await forShop(shopB.shopId).buybacks.upsertBasePrice({
      deviceModelId: iphone.id,
      storage: "128GB",
      basePrice: 20000,
    });

    expect(await forShop(shopA.shopId).buybacks.getBasePrice(iphone.id, "128GB")).toBe(30000);
    expect(await forShop(shopB.shopId).buybacks.getBasePrice(iphone.id, "128GB")).toBe(20000);
    expect(await forShop(shopA.shopId).buybacks.listBasePrices()).toHaveLength(1);
  });

  it("lists offered models grouped by brand with their priced storages", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const iphone = await model("iPhone 13");
    const galaxy = (await deviceCatalog.list()).find((m) => m.brand === "Samsung");
    if (!galaxy) throw new Error("No Samsung model");
    const buybacks = forShop(shopA.shopId).buybacks;

    expect(await buybacks.offeredModels()).toEqual([]);

    await buybacks.upsertBasePrice({ deviceModelId: iphone.id, storage: "256GB", basePrice: 1 });
    await buybacks.upsertBasePrice({ deviceModelId: iphone.id, storage: "128GB", basePrice: 1 });
    await buybacks.upsertBasePrice({
      deviceModelId: galaxy.id,
      storage: galaxy.storageOptions[0],
      basePrice: 1,
    });
    await forShop(shopB.shopId).buybacks.upsertBasePrice({
      deviceModelId: (await model("iPhone 12")).id,
      storage: "64GB",
      basePrice: 1,
    });

    const offered = await buybacks.offeredModels();
    expect(offered.map((b) => b.brand)).toEqual(["Apple", "Samsung"]);
    expect(offered[0].models).toEqual([
      { deviceModelId: iphone.id, name: "iPhone 13", storages: ["128GB", "256GB"] },
    ]);
    expect(offered[1].models).toEqual([
      { deviceModelId: galaxy.id, name: galaxy.name, storages: [galaxy.storageOptions[0]] },
    ]);
  });
});

describe("removing base prices", () => {
  it("removes one price from its own shop only", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const iphone = await model("iPhone 13");
    for (const shop of [shopA, shopB]) {
      await forShop(shop.shopId).buybacks.upsertBasePrice({
        deviceModelId: iphone.id,
        storage: "128GB",
        basePrice: 30000,
      });
    }

    await forShop(shopA.shopId).buybacks.removeBasePrice(iphone.id, "128GB");

    expect(await forShop(shopA.shopId).buybacks.getBasePrice(iphone.id, "128GB")).toBeNull();
    expect(await forShop(shopA.shopId).buybacks.offeredModels()).toEqual([]);
    expect(await forShop(shopB.shopId).buybacks.getBasePrice(iphone.id, "128GB")).toBe(30000);
  });
});

describe("buyback deductions", () => {
  it("replaces all of a shop's rules at once, leaving other shops alone", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const buybacks = forShop(shopA.shopId).buybacks;
    await buybacks.setDeduction({ questionKey: "screen_cracked", answer: true, kind: "amount", value: 5000 });
    await buybacks.setDeduction({ questionKey: "battery_ok", answer: false, kind: "amount", value: 1000 });
    await forShop(shopB.shopId).buybacks.setDeduction({
      questionKey: "battery_ok",
      answer: false,
      kind: "amount",
      value: 700,
    });

    await buybacks.replaceDeductions([
      { questionKey: "screen_cracked", answer: true, kind: "amount", value: 7000 },
      { questionKey: "powers_on", answer: false, kind: "floor", value: 2000 },
    ]);

    const rules = await buybacks.listDeductions();
    expect(rules).toHaveLength(2);
    expect(rules).toContainEqual({ questionKey: "screen_cracked", answer: true, kind: "amount", value: 7000 });
    expect(rules).toContainEqual({ questionKey: "powers_on", answer: false, kind: "floor", value: 2000 });
    expect(await forShop(shopB.shopId).buybacks.listDeductions()).toHaveLength(1);

    await buybacks.replaceDeductions([]);
    expect(await buybacks.listDeductions()).toEqual([]);
  });

  it("keeps the old rules when a replacement fails part way", async () => {
    const { shopA } = await seedTwoShops();
    const buybacks = forShop(shopA.shopId).buybacks;
    await buybacks.setDeduction({ questionKey: "screen_cracked", answer: true, kind: "amount", value: 5000 });

    await expect(
      buybacks.replaceDeductions([
        { questionKey: "battery_ok", answer: false, kind: "amount", value: 1000 },
        { questionKey: "powers_on", answer: false, kind: "floor", value: 2_147_483_648 },
      ]),
    ).rejects.toThrow();

    expect(await buybacks.listDeductions()).toEqual([
      { questionKey: "screen_cracked", answer: true, kind: "amount", value: 5000 },
    ]);
  });

  it("sets one rule per question and answer, replacing it on a second set", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const buybacks = forShop(shopA.shopId).buybacks;

    await buybacks.setDeduction({ questionKey: "screen_cracked", answer: true, kind: "amount", value: 5000 });
    await buybacks.setDeduction({ questionKey: "screen_cracked", answer: true, kind: "amount", value: 6000 });
    await buybacks.setDeduction({ questionKey: "powers_on", answer: false, kind: "floor", value: 2000 });
    await forShop(shopB.shopId).buybacks.setDeduction({
      questionKey: "battery_ok",
      answer: false,
      kind: "amount",
      value: 1000,
    });

    const rules = await buybacks.listDeductions();
    expect(rules).toHaveLength(2);
    expect(rules).toContainEqual({ questionKey: "screen_cracked", answer: true, kind: "amount", value: 6000 });
    expect(rules).toContainEqual({ questionKey: "powers_on", answer: false, kind: "floor", value: 2000 });
    expect(await forShop(shopB.shopId).buybacks.listDeductions()).toEqual([
      { questionKey: "battery_ok", answer: false, kind: "amount", value: 1000 },
    ]);
  });

  it("removes a rule only from its own shop", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const rule = { questionKey: "screen_cracked", answer: true, kind: "amount", value: 5000 } as const;
    await forShop(shopA.shopId).buybacks.setDeduction(rule);
    await forShop(shopB.shopId).buybacks.setDeduction(rule);

    await forShop(shopA.shopId).buybacks.removeDeduction("screen_cracked", true);

    expect(await forShop(shopA.shopId).buybacks.listDeductions()).toEqual([]);
    expect(await forShop(shopB.shopId).buybacks.listDeductions()).toEqual([rule]);
  });
});

describe("buyback quotes", () => {
  it("inserts a quoted quote and reads it back for its own shop only", async () => {
    const { shopA, shopB } = await seedTwoShops();

    const quote = await quoteFor(shopA.shopId);

    expect(quote).toMatchObject({ status: "quoted", offer: 25000, storage: "128GB", handover: "drop_in" });
    expect(await forShop(shopA.shopId).buybacks.getQuote(quote.id)).toMatchObject({ id: quote.id, offer: 25000 });
    expect(await forShop(shopB.shopId).buybacks.getQuote(quote.id)).toBeNull();
    expect(await forShop(shopA.shopId).buybacks.getQuote("no-such-quote")).toBeNull();
  });

  it("accepts a quoted quote once, storing the customer and drop-in handover", async () => {
    const { shopA } = await seedTwoShops();
    const buybacks = forShop(shopA.shopId).buybacks;
    const quote = await quoteFor(shopA.shopId);

    expect(await buybacks.acceptQuote(quote.id, CUSTOMER)).toBe(true);
    expect(await buybacks.acceptQuote(quote.id, { ...CUSTOMER, name: "Someone Else" })).toBe(false);

    expect(await buybacks.getQuote(quote.id)).toMatchObject({
      status: "accepted",
      handover: "drop_in",
      customer: CUSTOMER,
    });
  });

  it("lets only one of two simultaneous accepts win", async () => {
    const { shopA } = await seedTwoShops();
    const buybacks = forShop(shopA.shopId).buybacks;
    const quote = await quoteFor(shopA.shopId);

    const results = await Promise.all([
      buybacks.acceptQuote(quote.id, CUSTOMER),
      buybacks.acceptQuote(quote.id, CUSTOMER),
      buybacks.acceptQuote(quote.id, CUSTOMER),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("does not accept an expired quote or another shop's quote", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const iphone = await model("iPhone 13");
    const expired = await forShop(shopA.shopId).buybacks.insertQuote({
      deviceModelId: iphone.id,
      storage: "128GB",
      answers: {},
      offer: 1000,
      expiresAt: new Date(Date.now() - 1000),
    });
    const live = await quoteFor(shopA.shopId);

    expect(await forShop(shopA.shopId).buybacks.acceptQuote(expired.id, CUSTOMER)).toBe(false);
    expect(await forShop(shopB.shopId).buybacks.acceptQuote(live.id, CUSTOMER)).toBe(false);
    expect((await forShop(shopA.shopId).buybacks.getQuote(live.id))?.status).toBe("quoted");
  });

  it("marks received only an accepted quote of its own shop", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const buybacks = forShop(shopA.shopId).buybacks;
    const quote = await quoteFor(shopA.shopId);

    expect(await buybacks.markReceived(quote.id)).toBe(false);
    expect((await buybacks.getQuote(quote.id))?.status).toBe("quoted");

    await buybacks.acceptQuote(quote.id, CUSTOMER);
    expect(await forShop(shopB.shopId).buybacks.markReceived(quote.id)).toBe(false);
    expect((await buybacks.getQuote(quote.id))?.status).toBe("accepted");

    expect(await buybacks.markReceived(quote.id)).toBe(true);
    expect((await buybacks.getQuote(quote.id))?.status).toBe("received");
    expect(await buybacks.markReceived(quote.id)).toBe(false);
  });

  it("lists quotes per shop with device names, filtered by status", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const buybacks = forShop(shopA.shopId).buybacks;
    const accepted = await quoteFor(shopA.shopId, 20000);
    const open = await quoteFor(shopA.shopId, 10000);
    await quoteFor(shopB.shopId);
    await buybacks.acceptQuote(accepted.id, CUSTOMER);

    const all = await buybacks.listQuotes();
    expect(all.map((q) => q.id).sort()).toEqual([accepted.id, open.id].sort());

    const onlyAccepted = await buybacks.listQuotes({ statuses: ["accepted", "received"] });
    expect(onlyAccepted).toHaveLength(1);
    expect(onlyAccepted[0]).toMatchObject({
      id: accepted.id,
      status: "accepted",
      brand: "Apple",
      deviceName: "iPhone 13",
      offer: 20000,
      customer: CUSTOMER,
    });
  });
});
