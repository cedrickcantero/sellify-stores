import { describe, expect, it } from "vitest";
import { forShop } from "@/data";
import { createFakeMailer } from "@/email";
import { seedTwoShops, type TestShop } from "@/test/seed";
import { bookRepair, listSlots } from "./repair-booking";
import { publishStore, saveDraft } from "./store";

// Thursday 10 January 2030; Dublin is on GMT then, so wall time equals UTC.
const DATE = "2030-01-10";
const NOW = new Date("2030-01-08T12:00:00.000Z");
const customer = { name: "John", phone: "085 123 4567", email: "john@example.com" };

// A published store open 09:00 to 11:00 on Thursdays in 30 minute slots,
// with one repair price (iPhone 12 screen, €89, two parts in stock).
async function openShop(shop: TestShop, opts: { capacity?: number; contactEmail?: string; repairTab?: boolean } = {}) {
  await saveDraft(shop.shopId, {
    contact: { email: opts.contactEmail ?? "" },
    openingHours: { thu: { open: "09:00", close: "11:00" } },
    repair: { slotMinutes: 30, slotCapacity: opts.capacity ?? 1 },
    tabs: { repair: opts.repairTab ?? true },
  });
  await publishStore(shop.shopId, shop.owner.userId);
  const repairs = forShop(shop.shopId).repairs;
  const type = await repairs.createType("Screen");
  const price = await repairs.upsertPrice({
    deviceModelId: "apple-iphone-12",
    repairTypeId: type.id,
    price: 8900,
    partQty: 2,
  });
  return price.id;
}

describe("listSlots", () => {
  it("lists the free future slots of the day in the shop's opening hours", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);

    expect(await listSlots(shopA.shopId, priceId, DATE, { now: NOW })).toEqual([
      "2030-01-10T09:00:00.000Z",
      "2030-01-10T09:30:00.000Z",
      "2030-01-10T10:00:00.000Z",
      "2030-01-10T10:30:00.000Z",
    ]);
  });

  it("leaves out a slot once it is booked to capacity", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);
    const mailer = createFakeMailer();
    await bookRepair(shopA.shopId, { repairPriceId: priceId, slotStart: "2030-01-10T09:30:00.000Z", customer }, { mailer, now: NOW });

    expect(await listSlots(shopA.shopId, priceId, DATE, { now: NOW })).not.toContain("2030-01-10T09:30:00.000Z");
  });

  it("lists nothing beyond 30 days ahead, before today, or for another shop's price", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const priceId = await openShop(shopA);
    const otherPrice = await openShop(shopB);

    expect(await listSlots(shopA.shopId, priceId, "2030-02-14", { now: NOW })).toEqual([]);
    expect(await listSlots(shopA.shopId, priceId, "2030-01-03", { now: NOW })).toEqual([]);
    expect(await listSlots(shopA.shopId, otherPrice, DATE, { now: NOW })).toEqual([]);
  });
});

describe("bookRepair", () => {
  it("creates an online ticket at the shop's price and emails both sides", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA, { contactEmail: "bookings@fixit.example" });
    const mailer = createFakeMailer();

    const result = await bookRepair(
      shopA.shopId,
      { repairPriceId: priceId, slotStart: "2030-01-10T10:00:00.000Z", customer },
      { mailer, now: NOW },
    );

    expect(result.ok).toBe(true);
    const [ticket] = await forShop(shopA.shopId).repairs.listTickets();
    expect(ticket).toMatchObject({
      id: result.ok ? result.value.ticketId : "",
      priceSnapshot: 8900,
      source: "online",
      status: "booked",
      slotStart: new Date("2030-01-10T10:00:00.000Z"),
      customerName: "John",
      customerPhone: "085 123 4567",
      customerEmail: "john@example.com",
    });

    const outbox = await forShop(shopA.shopId).emailOutbox.list();
    const shopEmail = outbox.find((e) => e.kind === "repair_booked_shop");
    const customerEmail = outbox.find((e) => e.kind === "repair_booked_customer");
    expect(shopEmail).toMatchObject({
      recipient: "bookings@fixit.example",
      subject: "New repair booking: iPhone 12 Screen, Thursday 10am, John",
      status: "sent",
    });
    expect(customerEmail).toMatchObject({ recipient: "john@example.com", status: "sent" });
    expect(customerEmail?.body).toContain("€89.00");
    expect(customerEmail?.body).toContain("Thursday 10 January at 10am");
    expect(shopEmail?.body).toContain("Thursday 10 January at 10am");
  });

  it("sends the shop email to the owner when the store has no contact email", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);

    await bookRepair(
      shopA.shopId,
      { repairPriceId: priceId, slotStart: "2030-01-10T10:00:00.000Z", customer },
      { mailer: createFakeMailer(), now: NOW },
    );

    const outbox = await forShop(shopA.shopId).emailOutbox.list();
    expect(outbox.find((e) => e.kind === "repair_booked_shop")?.recipient).toBe(shopA.owner.email);
  });

  it("escapes what the customer typed in the email bodies", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);

    await bookRepair(
      shopA.shopId,
      { repairPriceId: priceId, slotStart: "2030-01-10T10:00:00.000Z", customer: { ...customer, name: "<b>Eve</b>" } },
      { mailer: createFakeMailer(), now: NOW },
    );

    const outbox = await forShop(shopA.shopId).emailOutbox.list();
    for (const email of outbox) expect(email.body).not.toContain("<b>Eve</b>");
  });

  it("keeps the price snapshot when the shop changes the price later", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);
    await bookRepair(
      shopA.shopId,
      { repairPriceId: priceId, slotStart: "2030-01-10T10:00:00.000Z", customer },
      { mailer: createFakeMailer(), now: NOW },
    );

    const repairs = forShop(shopA.shopId).repairs;
    const price = await repairs.getPrice(priceId);
    await repairs.upsertPrice({ deviceModelId: price!.deviceModelId, repairTypeId: price!.repairTypeId, price: 9900, partQty: 1 });

    expect((await repairs.listTickets())[0].priceSnapshot).toBe(8900);
  });

  it("rejects a booking beyond the slot's capacity as slot_taken", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA, { capacity: 2 });
    const book = () =>
      bookRepair(
        shopA.shopId,
        { repairPriceId: priceId, slotStart: "2030-01-10T10:00:00.000Z", customer },
        { mailer: createFakeMailer(), now: NOW },
      );

    expect((await book()).ok).toBe(true);
    expect((await book()).ok).toBe(true);
    expect(await book()).toEqual({ ok: false, error: "slot_taken" });
    expect(await forShop(shopA.shopId).repairs.listTickets()).toHaveLength(2);
  });

  it("lets only one of two simultaneous bookings take the last place", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);
    const input = { repairPriceId: priceId, slotStart: "2030-01-10T10:00:00.000Z", customer };

    const results = await Promise.all([
      bookRepair(shopA.shopId, input, { mailer: createFakeMailer(), now: NOW }),
      bookRepair(shopA.shopId, input, { mailer: createFakeMailer(), now: NOW }),
    ]);

    expect(results.map((r) => r.ok).sort()).toEqual([false, true]);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: "slot_taken" });
  });

  it("rejects a slot that has already started as slot_in_past", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);

    const result = await bookRepair(
      shopA.shopId,
      { repairPriceId: priceId, slotStart: "2030-01-10T09:00:00.000Z", customer },
      { mailer: createFakeMailer(), now: new Date("2030-01-10T09:10:00.000Z") },
    );

    expect(result).toEqual({ ok: false, error: "slot_in_past" });
    expect(await forShop(shopA.shopId).repairs.listTickets()).toEqual([]);
  });

  it("rejects a slot outside the opening hours or off the slot grid as not_offered", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);
    const book = (slotStart: string) =>
      bookRepair(shopA.shopId, { repairPriceId: priceId, slotStart, customer }, { mailer: createFakeMailer(), now: NOW });

    expect(await book("2030-01-10T12:00:00.000Z")).toEqual({ ok: false, error: "not_offered" });
    expect(await book("2030-01-10T09:10:00.000Z")).toEqual({ ok: false, error: "not_offered" });
    // Friday is open 09:00 to 18:00 by default, but beyond 30 days ahead.
    expect(await book("2030-02-15T10:00:00.000Z")).toEqual({ ok: false, error: "not_offered" });
    expect(await book("not a date")).toEqual({ ok: false, error: "not_offered" });
    expect(await forShop(shopA.shopId).repairs.listTickets()).toEqual([]);
  });

  it("rejects another shop's repair price as not_offered", async () => {
    const { shopA, shopB } = await seedTwoShops();
    await openShop(shopA);
    const otherPrice = await openShop(shopB);

    const result = await bookRepair(
      shopA.shopId,
      { repairPriceId: otherPrice, slotStart: "2030-01-10T10:00:00.000Z", customer },
      { mailer: createFakeMailer(), now: NOW },
    );

    expect(result).toEqual({ ok: false, error: "not_offered" });
    expect(await forShop(shopA.shopId).repairs.listTickets()).toEqual([]);
    expect(await forShop(shopB.shopId).repairs.listTickets()).toEqual([]);
  });

  it("rejects bookings when the published store has the Repair tab off", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA, { repairTab: false });

    const result = await bookRepair(
      shopA.shopId,
      { repairPriceId: priceId, slotStart: "2030-01-10T10:00:00.000Z", customer },
      { mailer: createFakeMailer(), now: NOW },
    );

    expect(result).toEqual({ ok: false, error: "not_offered" });
    expect(await listSlots(shopA.shopId, priceId, DATE, { now: NOW })).toEqual([]);
  });

  it("still books when the mailer fails, and records both emails as failed", async () => {
    const { shopA } = await seedTwoShops();
    const priceId = await openShop(shopA);

    const result = await bookRepair(
      shopA.shopId,
      { repairPriceId: priceId, slotStart: "2030-01-10T10:00:00.000Z", customer },
      { mailer: createFakeMailer({ fail: true }), now: NOW },
    );

    expect(result.ok).toBe(true);
    expect(await forShop(shopA.shopId).repairs.listTickets()).toHaveLength(1);
    const outbox = await forShop(shopA.shopId).emailOutbox.list();
    expect(outbox.map((e) => [e.kind, e.status]).sort()).toEqual([
      ["repair_booked_customer", "failed"],
      ["repair_booked_shop", "failed"],
    ]);
  });
});
