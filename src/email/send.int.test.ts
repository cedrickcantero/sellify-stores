import { describe, expect, it } from "vitest";
import { forShop } from "@/data";
import { seedTwoShops } from "@/test/seed";
import { createFakeMailer } from "./fake";
import { sendEmail } from "./send";

const msg = {
  to: "customer@example.com",
  subject: "Your repair is booked",
  html: "<p>See you Monday.</p>",
  kind: "repair_booked_customer",
} as const;

describe("sendEmail", () => {
  it("records a sent email after the mailer delivers it", async () => {
    const { shopA } = await seedTwoShops();
    const mailer = createFakeMailer();

    const result = await sendEmail(shopA.shopId, msg, mailer);

    expect(result).toEqual({ status: "sent" });
    expect(mailer.sent).toEqual([{ to: msg.to, subject: msg.subject, html: msg.html }]);
    const rows = await forShop(shopA.shopId).emailOutbox.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipient: msg.to,
      subject: msg.subject,
      body: msg.html,
      kind: "repair_booked_customer",
      status: "sent",
      error: null,
    });
  });

  it("writes the outbox row as pending before the mailer is called", async () => {
    const { shopA } = await seedTwoShops();
    let statusDuringSend: string | undefined;
    const mailer = {
      async send() {
        statusDuringSend = (await forShop(shopA.shopId).emailOutbox.list())[0]?.status;
      },
    };

    await sendEmail(shopA.shopId, msg, mailer);

    expect(statusDuringSend).toBe("pending");
  });

  it("records failed with the provider error and resolves normally when the mailer fails", async () => {
    const { shopA } = await seedTwoShops();

    const result = await sendEmail(shopA.shopId, msg, createFakeMailer({ fail: true }));

    expect(result).toEqual({ status: "failed" });
    const [row] = await forShop(shopA.shopId).emailOutbox.list();
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/fake mailer/i);
  });

  it("resolves failed when the mailer throws something that is not an Error", async () => {
    const { shopA } = await seedTwoShops();
    const mailer = {
      async send() {
        throw "boom";
      },
    };

    expect(await sendEmail(shopA.shopId, msg, mailer)).toEqual({ status: "failed" });
    expect((await forShop(shopA.shopId).emailOutbox.list())[0].error).toBe("boom");
  });

  it("fails gracefully with a clear error when Resend is not configured", async () => {
    const { shopA } = await seedTwoShops();
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      expect(await sendEmail(shopA.shopId, msg)).toEqual({ status: "failed" });
    } finally {
      if (saved !== undefined) process.env.RESEND_API_KEY = saved;
    }
    const [row] = await forShop(shopA.shopId).emailOutbox.list();
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/RESEND_API_KEY/);
  });

  it("keeps each shop's outbox separate", async () => {
    const { shopA, shopB } = await seedTwoShops();
    const mailer = createFakeMailer();

    await sendEmail(shopA.shopId, { ...msg, subject: "For A" }, mailer);
    await sendEmail(shopB.shopId, { ...msg, subject: "For B" }, mailer);
    await sendEmail(shopB.shopId, { ...msg, subject: "Also for B" }, createFakeMailer({ fail: true }));

    const fromA = await forShop(shopA.shopId).emailOutbox.list();
    const fromB = await forShop(shopB.shopId).emailOutbox.list();
    expect(fromA.map((r) => r.subject)).toEqual(["For A"]);
    expect(fromB.map((r) => r.subject).sort()).toEqual(["Also for B", "For B"]);
  });

  it("never throws, even when the outbox cannot be written", async () => {
    const result = await sendEmail("no-such-shop", msg, createFakeMailer());
    expect(result).toEqual({ status: "failed" });
  });
});
