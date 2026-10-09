import { describe, expect, it } from "vitest";
import { seedTwoShops } from "@/test/seed";
import { deviceCatalog, forShop, SlotTakenError } from "./index";
import { db } from "./db";
import { sql } from "drizzle-orm";

async function models() {
  const all = await deviceCatalog.list();
  const apple = all.filter((m) => m.brand === "Apple");
  const samsung = all.filter((m) => m.brand === "Samsung");
  return { apple, samsung };
}

const customer = { customerName: "John", customerPhone: "0851234567", customerEmail: "john@example.com" };
const slot = new Date("2030-01-10T14:00:00.000Z");

describe("repair types and prices", () => {
  it("creates repair types per shop and lists them by name", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const a = forShop(shopA.shopId).repairs;

    await a.createType("Screen");
    await a.createType("Battery");
    await forShop(shopB.shopId).repairs.createType("Water damage");

    expect((await a.listTypes()).map((t) => t.name)).toEqual(["Battery", "Screen"]);
    expect((await forShop(shopB.shopId).repairs.listTypes()).map((t) => t.name)).toEqual([
      "Water damage",
    ]);
  });

  it("returns the existing type when the same name is created twice", async () => {
    const { shopA } = await seedTwoShops();
    const repairs = forShop(shopA.shopId).repairs;

    const first = await repairs.createType("Screen");
    const second = await repairs.createType("Screen");

    expect(second.id).toBe(first.id);
    expect(await repairs.listTypes()).toHaveLength(1);
  });

  it("upserts one price per model and repair type", async () => {
    const { shopA } = await seedTwoShops();
    const repairs = forShop(shopA.shopId).repairs;
    const { apple } = await models();
    const screen = await repairs.createType("Screen");

    const first = await repairs.upsertPrice({
      deviceModelId: apple[0].id,
      repairTypeId: screen.id,
      price: 8900,
      partQty: 2,
    });
    const second = await repairs.upsertPrice({
      deviceModelId: apple[0].id,
      repairTypeId: screen.id,
      price: 9900,
      partQty: 0,
    });

    expect(second.id).toBe(first.id);
    expect(await repairs.getPrice(first.id)).toMatchObject({
      id: first.id,
      deviceModelId: apple[0].id,
      repairTypeId: screen.id,
      price: 9900,
      partQty: 0,
    });
    expect(await repairs.listPrices()).toHaveLength(1);
  });

  it("rejects a repair type from another shop and negative values", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const { apple } = await models();
    const foreign = await forShop(shopB.shopId).repairs.createType("Screen");
    const own = await forShop(shopA.shopId).repairs.createType("Screen");
    const repairs = forShop(shopA.shopId).repairs;

    await expect(
      repairs.upsertPrice({ deviceModelId: apple[0].id, repairTypeId: foreign.id, price: 1, partQty: 0 }),
    ).rejects.toThrow();
    await expect(
      repairs.upsertPrice({ deviceModelId: apple[0].id, repairTypeId: own.id, price: -1, partQty: 0 }),
    ).rejects.toThrow();
    expect(await repairs.listPrices()).toHaveLength(0);
  });

  it("keeps prices isolated per shop", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const { apple } = await models();
    const a = forShop(shopA.shopId).repairs;
    const b = forShop(shopB.shopId).repairs;
    const screenA = await a.createType("Screen");
    const screenB = await b.createType("Screen");

    const priceA = await a.upsertPrice({ deviceModelId: apple[0].id, repairTypeId: screenA.id, price: 8900, partQty: 1 });
    const priceB = await b.upsertPrice({ deviceModelId: apple[0].id, repairTypeId: screenB.id, price: 5000, partQty: 4 });

    expect(priceA.id).not.toBe(priceB.id);
    expect((await a.listPrices()).map((p) => p.price)).toEqual([8900]);
    expect((await b.listPrices()).map((p) => p.price)).toEqual([5000]);
    expect(await a.getPrice(priceB.id)).toBeNull();
    expect(await b.getPrice(priceA.id)).toBeNull();
  });
});

describe("offeredModels", () => {
  it("returns only brands, models and repair types that have a price row", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const { apple, samsung } = await models();
    const repairs = forShop(shopA.shopId).repairs;
    const screen = await repairs.createType("Screen");
    const battery = await repairs.createType("Battery");
    await repairs.createType("Unused type");
    const iphone = await repairs.upsertPrice({ deviceModelId: apple[0].id, repairTypeId: screen.id, price: 8900, partQty: 2 });
    const iphoneBattery = await repairs.upsertPrice({ deviceModelId: apple[0].id, repairTypeId: battery.id, price: 4900, partQty: 0 });
    // Another shop's price must not leak in.
    const other = forShop(shopB.shopId).repairs;
    const otherScreen = await other.createType("Screen");
    await other.upsertPrice({ deviceModelId: samsung[0].id, repairTypeId: otherScreen.id, price: 1, partQty: 1 });

    const offered = await repairs.offeredModels();

    expect(offered).toEqual([
      {
        brand: "Apple",
        models: [
          {
            deviceModelId: apple[0].id,
            name: apple[0].name,
            repairs: [
              { repairPriceId: iphoneBattery.id, repairType: "Battery", price: 4900, partQty: 0 },
              { repairPriceId: iphone.id, repairType: "Screen", price: 8900, partQty: 2 },
            ],
          },
        ],
      },
    ]);
  });

  it("is empty for a shop with no prices", async () => {
    const { shopA } = await seedTwoShops();
    expect(await forShop(shopA.shopId).repairs.offeredModels()).toEqual([]);
  });
});

async function priceFor(shopId: string) {
  const { apple } = await models();
  const repairs = forShop(shopId).repairs;
  const screen = await repairs.createType("Screen");
  return repairs.upsertPrice({ deviceModelId: apple[0].id, repairTypeId: screen.id, price: 8900, partQty: 1 });
}

describe("insertTicket", () => {
  it("stores the ticket with the price snapshot and the first free sequence", async () => {
    const { shopA } = await seedTwoShops();
    const repairs = forShop(shopA.shopId).repairs;
    const price = await priceFor(shopA.shopId);

    const first = await repairs.insertTicket(db, {
      repairPriceId: price.id,
      priceSnapshot: price.price,
      slotStart: slot,
      capacity: 2,
      source: "online",
      ...customer,
    });
    const second = await repairs.insertTicket(db, {
      repairPriceId: price.id,
      priceSnapshot: price.price,
      slotStart: slot,
      capacity: 2,
      source: "walk_in",
      ...customer,
    });

    expect(first.slotSeq).toBe(1);
    expect(second.slotSeq).toBe(2);
    const tickets = await repairs.listTickets();
    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toMatchObject({
      priceSnapshot: 8900,
      status: "booked",
      customerName: "John",
      repairType: "Screen",
    });
  });

  it("throws SlotTakenError when the slot is at capacity", async () => {
    const { shopA } = await seedTwoShops();
    const repairs = forShop(shopA.shopId).repairs;
    const price = await priceFor(shopA.shopId);
    const input = { repairPriceId: price.id, priceSnapshot: 8900, slotStart: slot, capacity: 1, source: "online" as const, ...customer };

    await repairs.insertTicket(db, input);

    await expect(repairs.insertTicket(db, input)).rejects.toBeInstanceOf(SlotTakenError);
    expect(await repairs.listTickets()).toHaveLength(1);
  });

  it("never exceeds capacity under concurrent inserts", async () => {
    const { shopA } = await seedTwoShops();
    const repairs = forShop(shopA.shopId).repairs;
    const price = await priceFor(shopA.shopId);
    const input = { repairPriceId: price.id, priceSnapshot: 8900, slotStart: slot, capacity: 2, source: "online" as const, ...customer };

    const results = await Promise.allSettled(Array.from({ length: 6 }, () => repairs.insertTicket(db, input)));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect(r.reason).toBeInstanceOf(SlotTakenError);
    }
    const seqs = (await repairs.listTickets()).map((t) => t.slotSeq).sort();
    expect(seqs).toEqual([1, 2]);
  });

  it("rolls back with the surrounding transaction", async () => {
    const { shopA } = await seedTwoShops();
    const repairs = forShop(shopA.shopId).repairs;
    const price = await priceFor(shopA.shopId);

    await expect(
      db.transaction(async (tx) => {
        await repairs.insertTicket(tx, { repairPriceId: price.id, priceSnapshot: 1, slotStart: slot, capacity: 1, source: "online", ...customer });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    expect(await repairs.listTickets()).toHaveLength(0);
  });

  it("rejects a repair price from another shop", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const foreign = await priceFor(shopB.shopId);

    await expect(
      forShop(shopA.shopId).repairs.insertTicket(db, {
        repairPriceId: foreign.id, priceSnapshot: 1, slotStart: slot, capacity: 1, source: "online", ...customer,
      }),
    ).rejects.toThrow();
  });
});

describe("bookedCounts", () => {
  it("counts non-cancelled tickets per slot start inside the range, for this shop only", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const repairs = forShop(shopA.shopId).repairs;
    const price = await priceFor(shopA.shopId);
    const foreignPrice = await priceFor(shopB.shopId);
    const base = { repairPriceId: price.id, priceSnapshot: 1, capacity: 5, source: "online" as const, ...customer };
    const nine = new Date("2030-01-10T09:00:00.000Z");
    const ten = new Date("2030-01-10T10:00:00.000Z");
    const nextDay = new Date("2030-01-11T09:00:00.000Z");
    await repairs.insertTicket(db, { ...base, slotStart: nine });
    await repairs.insertTicket(db, { ...base, slotStart: nine });
    const cancelled = await repairs.insertTicket(db, { ...base, slotStart: ten });
    await repairs.setTicketStatus(cancelled.id, "cancelled");
    await repairs.insertTicket(db, { ...base, slotStart: nextDay });
    await forShop(shopB.shopId).repairs.insertTicket(db, { ...base, repairPriceId: foreignPrice.id, slotStart: nine });

    const counts = await repairs.bookedCounts(new Date("2030-01-10T00:00:00.000Z"), new Date("2030-01-11T00:00:00.000Z"));

    expect(counts).toEqual(new Map([[nine.toISOString(), 2]]));
  });

  it("frees a cancelled ticket's place in the slot", async () => {
    const { shopA } = await seedTwoShops();
    const repairs = forShop(shopA.shopId).repairs;
    const price = await priceFor(shopA.shopId);
    const input = { repairPriceId: price.id, priceSnapshot: 1, slotStart: slot, capacity: 1, source: "online" as const, ...customer };
    const ticket = await repairs.insertTicket(db, input);
    await repairs.setTicketStatus(ticket.id, "cancelled");

    const again = await repairs.insertTicket(db, input);

    expect(again.slotSeq).toBe(1);
    await expect(repairs.setTicketStatus(ticket.id, "booked")).rejects.toBeInstanceOf(SlotTakenError);
  });
});

describe("tickets", () => {
  it("changes status only for this shop's tickets", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const priceA = await priceFor(shopA.shopId);
    const a = forShop(shopA.shopId).repairs;
    const ticket = await a.insertTicket(db, { repairPriceId: priceA.id, priceSnapshot: 1, slotStart: slot, capacity: 1, source: "online", ...customer });

    expect(await forShop(shopB.shopId).repairs.setTicketStatus(ticket.id, "done")).toBe(false);
    expect((await a.listTickets())[0].status).toBe("booked");
    expect(await a.setTicketStatus(ticket.id, "in_progress")).toBe(true);
    expect((await a.listTickets())[0].status).toBe("in_progress");
    expect(await forShop(shopB.shopId).repairs.listTickets()).toEqual([]);
  });

  it("filters by status and by slot date in the shop's timezone", async () => {
    const { shopA } = await seedTwoShops();
    await db.execute(sql`UPDATE shop SET timezone = 'Pacific/Auckland' WHERE id = ${shopA.shopId}`);
    const a = forShop(shopA.shopId).repairs;
    const price = await priceFor(shopA.shopId);
    const base = { repairPriceId: price.id, priceSnapshot: 1, capacity: 3, source: "walk_in" as const, ...customer };
    // 2030-01-10T20:00Z is 2030-01-11 09:00 in Auckland (UTC+13 in January).
    const onEleventh = await a.insertTicket(db, { ...base, slotStart: new Date("2030-01-10T20:00:00.000Z") });
    await a.insertTicket(db, { ...base, slotStart: new Date("2030-01-10T10:00:00.000Z") });
    await a.setTicketStatus(onEleventh.id, "done");

    expect((await a.listTickets({ date: "2030-01-11" })).map((t) => t.id)).toEqual([onEleventh.id]);
    expect(await a.listTickets({ status: "done" })).toHaveLength(1);
    expect(await a.listTickets({ status: "done", date: "2030-01-10" })).toHaveLength(0);
    expect(await a.listTickets()).toHaveLength(2);
  });
});
