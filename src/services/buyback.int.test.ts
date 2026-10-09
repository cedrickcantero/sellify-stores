import { describe, expect, it } from "vitest";
import { deviceCatalog, forShop } from "@/data";
import { createFakeMailer } from "@/email";
import { defaultStoreConfig } from "@/domain/store-config";
import { cancelBuybackQuote, seedTwoShops } from "@/test/seed";
import { createQuote, submitBuyback } from "./buyback";

const CUSTOMER = { name: "Niamh <b>Walsh</b>", phone: "085 123 4567", email: "niamh@example.com" };
const DAY = 24 * 60 * 60 * 1000;

async function iphone() {
  const found = (await deviceCatalog.list()).find((m) => m.name === "iPhone 13");
  if (!found) throw new Error("Missing iPhone 13 in the device catalog");
  return found;
}

// A shop buying an iPhone 13 128GB at 300.00, with 50.00 off a cracked
// screen and a fixed 30.00 offer for a phone that does not turn on.
async function shopBuyingIphone(shopId: string) {
  const model = await iphone();
  const buybacks = forShop(shopId).buybacks;
  await buybacks.upsertBasePrice({ deviceModelId: model.id, storage: "128GB", basePrice: 30000 });
  await buybacks.replaceDeductions([
    { questionKey: "screen_cracked", answer: true, kind: "amount", value: 5000 },
    { questionKey: "powers_on", answer: false, kind: "floor", value: 3000 },
  ]);
  return model;
}

const input = (deviceModelId: string, answers = { screen_cracked: true, battery_ok: true, powers_on: true }) => ({
  deviceModelId,
  storage: "128GB",
  answers,
});

describe("createQuote", () => {
  it("computes the offer on the server, stores it and expires in 7 days", async () => {
    const { shopA } = await seedTwoShops();
    const model = await shopBuyingIphone(shopA.shopId);
    const now = new Date("2026-10-01T10:00:00Z");

    const result = await createQuote(shopA.shopId, input(model.id), { now });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.offer).toBe(25000);
    expect(result.value.expiresAt).toEqual(new Date(now.getTime() + 7 * DAY));
    const stored = await forShop(shopA.shopId).buybacks.getQuote(result.value.quoteId);
    expect(stored).toMatchObject({
      offer: 25000,
      status: "quoted",
      storage: "128GB",
      answers: { screen_cracked: true, battery_ok: true, powers_on: true },
    });
  });

  it("applies a floor rule from the shop's deductions", async () => {
    const { shopA } = await seedTwoShops();
    const model = await shopBuyingIphone(shopA.shopId);

    const result = await createQuote(
      shopA.shopId,
      input(model.id, { screen_cracked: true, battery_ok: true, powers_on: false }),
    );

    expect(result).toMatchObject({ ok: true, value: { offer: 3000 } });
  });

  it("fails with not_offered when the shop has no base price for that model and storage", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const model = await shopBuyingIphone(shopB.shopId);

    expect(await createQuote(shopA.shopId, input(model.id))).toEqual({ ok: false, error: "not_offered" });
    expect(await createQuote(shopB.shopId, { ...input(model.id), storage: "512GB" })).toEqual({
      ok: false,
      error: "not_offered",
    });
    expect(await forShop(shopA.shopId).buybacks.listQuotes()).toEqual([]);
  });

  it("reports bad input as invalid, not as an unoffered phone", async () => {
    const { shopA } = await seedTwoShops();
    const model = await shopBuyingIphone(shopA.shopId);
    const bad = { ...input(model.id), answers: { screen_cracked: true, battery_ok: "yes" } };

    expect(await createQuote(shopA.shopId, bad as never)).toEqual({ ok: false, error: "invalid" });
    expect(await forShop(shopA.shopId).buybacks.listQuotes()).toEqual([]);
  });
});

describe("submitBuyback", () => {
  async function quoted(shopId: string, now?: Date) {
    const model = await shopBuyingIphone(shopId);
    const result = await createQuote(shopId, input(model.id), { now });
    if (!result.ok) throw new Error("expected a quote");
    return result.value;
  }

  it("accepts a quote at the offer that was computed and emails both sides", async () => {
    const { shopA } = await seedTwoShops();
    const quote = await quoted(shopA.shopId);
    const mailer = createFakeMailer();

    const result = await submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER, { mailer });

    expect(result).toEqual({ ok: true, value: { quoteId: quote.quoteId } });
    const stored = await forShop(shopA.shopId).buybacks.getQuote(quote.quoteId);
    expect(stored).toMatchObject({ status: "accepted", offer: quote.offer, handover: "drop_in", customer: CUSTOMER });
    expect(stored?.acceptedAt).toBeInstanceOf(Date);

    const rows = await forShop(shopA.shopId).emailOutbox.list();
    expect(rows.map((r) => r.kind).sort()).toEqual(["buyback_accepted_customer", "buyback_accepted_shop"]);
    const customerMail = rows.find((r) => r.kind === "buyback_accepted_customer");
    const shopMail = rows.find((r) => r.kind === "buyback_accepted_shop");
    expect(customerMail).toMatchObject({ recipient: CUSTOMER.email, status: "sent" });
    expect(customerMail?.body).toContain("€250.00");
    expect(customerMail?.body).toContain("iPhone 13");
    // Customer-typed text is escaped, never injected as markup.
    expect(shopMail?.body).toContain("Niamh &lt;b&gt;Walsh&lt;/b&gt;");
    expect(shopMail?.body).not.toContain("<b>Walsh");
    expect(shopMail?.body).toContain("€250.00");
    expect(mailer.sent).toHaveLength(2);
  });

  it("sends the shop email to the contact email in the published config, else the owner", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const published = defaultStoreConfig(shopA.name);
    published.contact.email = "hello@fixit.ie";
    await forShop(shopA.shopId).storeConfig.publish(published, shopA.owner.userId);

    const quoteA = await quoted(shopA.shopId);
    const quoteB = await quoted(shopB.shopId);
    await submitBuyback(shopA.shopId, quoteA.quoteId, CUSTOMER, { mailer: createFakeMailer() });
    await submitBuyback(shopB.shopId, quoteB.quoteId, CUSTOMER, { mailer: createFakeMailer() });

    const toShop = async (shopId: string) =>
      (await forShop(shopId).emailOutbox.list()).find((r) => r.kind === "buyback_accepted_shop")?.recipient;
    expect(await toShop(shopA.shopId)).toBe("hello@fixit.ie");
    expect(await toShop(shopB.shopId)).toBe(shopB.owner.email);
  });

  it("rejects an unknown quote and another shop's quote, changing nothing", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const quoteB = await quoted(shopB.shopId);

    expect(await submitBuyback(shopA.shopId, quoteB.quoteId, CUSTOMER)).toEqual({ ok: false, error: "not_found" });
    expect(await submitBuyback(shopA.shopId, "no-such-quote", CUSTOMER)).toEqual({ ok: false, error: "not_found" });

    expect((await forShop(shopB.shopId).buybacks.getQuote(quoteB.quoteId))?.status).toBe("quoted");
    expect(await forShop(shopA.shopId).emailOutbox.list()).toEqual([]);
    expect(await forShop(shopB.shopId).emailOutbox.list()).toEqual([]);
  });

  it("rejects an expired quote and sends nothing", async () => {
    const { shopA } = await seedTwoShops();
    const quote = await quoted(shopA.shopId);
    const later = new Date(quote.expiresAt.getTime() + 1000);

    const result = await submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER, { now: later });

    expect(result).toEqual({ ok: false, error: "expired" });
    expect((await forShop(shopA.shopId).buybacks.getQuote(quote.quoteId))?.status).toBe("quoted");
    expect(await forShop(shopA.shopId).emailOutbox.list()).toEqual([]);
  });

  it("rejects a second accept and sends no more email", async () => {
    const { shopA } = await seedTwoShops();
    const quote = await quoted(shopA.shopId);
    const mailer = createFakeMailer();

    await submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER, { mailer });
    const again = await submitBuyback(shopA.shopId, quote.quoteId, { ...CUSTOMER, name: "Someone Else" }, { mailer });

    expect(again).toEqual({ ok: false, error: "already_accepted" });
    expect((await forShop(shopA.shopId).buybacks.getQuote(quote.quoteId))?.customer?.name).toBe(CUSTOMER.name);
    expect(await forShop(shopA.shopId).emailOutbox.list()).toHaveLength(2);
  });

  it("lets only one of two simultaneous accepts win", async () => {
    const { shopA } = await seedTwoShops();
    const quote = await quoted(shopA.shopId);

    const results = await Promise.all([
      submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER, { mailer: createFakeMailer() }),
      submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER, { mailer: createFakeMailer() }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: "already_accepted" });
    expect(await forShop(shopA.shopId).emailOutbox.list()).toHaveLength(2);
  });

  it("reports a cancelled quote as cancelled, not as already accepted", async () => {
    const { shopA } = await seedTwoShops();
    const quote = await quoted(shopA.shopId);
    await cancelBuybackQuote(quote.quoteId);
    const mailer = createFakeMailer();

    expect(await submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER, { mailer })).toEqual({
      ok: false,
      error: "cancelled",
    });
    expect(mailer.sent).toHaveLength(0);
  });

  it("rejects a quote the shop already received", async () => {
    const { shopA } = await seedTwoShops();
    const quote = await quoted(shopA.shopId);
    await submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER, { mailer: createFakeMailer() });
    await forShop(shopA.shopId).buybacks.markReceived(quote.quoteId);

    expect(await submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER)).toEqual({
      ok: false,
      error: "already_accepted",
    });
  });

  it("still succeeds when the email cannot be delivered", async () => {
    const { shopA } = await seedTwoShops();
    const quote = await quoted(shopA.shopId);

    const result = await submitBuyback(shopA.shopId, quote.quoteId, CUSTOMER, {
      mailer: createFakeMailer({ fail: true }),
    });

    expect(result.ok).toBe(true);
    expect((await forShop(shopA.shopId).buybacks.getQuote(quote.quoteId))?.status).toBe("accepted");
    const rows = await forShop(shopA.shopId).emailOutbox.list();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "failed")).toBe(true);
  });
});
