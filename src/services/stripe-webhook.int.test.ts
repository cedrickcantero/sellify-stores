import { describe, expect, it, vi } from "vitest";
import { forShop } from "@/data";
import { createFakeMailer } from "@/email";
import { encodeOrderMetadata, type OrderLine } from "@/domain/order-metadata";
import { PaymentsNotConfiguredError, type PaidSession, type PaymentGateway } from "@/payments/gateway";
import { createFakeGateway, FAKE_SIGNATURE } from "@/test/fake-gateway";
import { seedTwoShops } from "@/test/seed";
import { handleStripeWebhook } from "./stripe-webhook";

// Fails a fulfilment on demand, to see how the webhook answers an unexpected error.
const failure = vi.hoisted(() => ({ next: false }));
vi.mock("./fulfil-order", async (importOriginal) => {
  const original = await importOriginal<typeof import("./fulfil-order")>();
  return {
    ...original,
    fulfilOrder: (...args: Parameters<typeof original.fulfilOrder>) => {
      if (failure.next) throw new Error("database down");
      return original.fulfilOrder(...args);
    },
  };
});

function paid(shopId: string, lines: OrderLine[], overrides: Partial<PaidSession> = {}): PaidSession {
  return {
    id: "cs_test_hook",
    metadata: encodeOrderMetadata(shopId, lines),
    clientReferenceId: shopId,
    customerEmail: "buyer@example.com",
    paymentStatus: "paid",
    amountTotal: lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    ...overrides,
  };
}
const body = (session: PaidSession | null, type = "checkout.session.completed") =>
  JSON.stringify({ id: "evt_1", type, session });

async function setup() {
  const { shopA, shopB } = await seedTwoShops();
  const repos = forShop(shopA.shopId);
  const phone = await repos.products.create({
    title: "Pixel",
    kind: "phone",
    condition: "good",
    price: 20000,
    stockQty: 2,
    images: [],
    deviceModelId: null,
  });
  return { shopA, shopB, repos, phone, line: { productId: phone.id, qty: 1, unitPrice: 20000 } };
}

describe("handleStripeWebhook", () => {
  it("fulfils a verified checkout.session.completed once, however often it is delivered", async () => {
    const { shopA, repos, phone, line } = await setup();
    const deps = { gateway: createFakeGateway(), mailer: createFakeMailer() };
    const raw = body(paid(shopA.shopId, [line]));

    expect(await handleStripeWebhook(raw, FAKE_SIGNATURE, deps)).toMatchObject({ status: 200 });
    expect(await handleStripeWebhook(raw, FAKE_SIGNATURE, deps)).toMatchObject({ status: 200 });

    expect(await repos.sales.list()).toHaveLength(1);
    expect((await repos.products.get(phone.id))?.stockQty).toBe(1);
  });

  it("rejects a bad or missing signature with 400 and does nothing", async () => {
    const { shopA, repos, line } = await setup();
    const deps = { gateway: createFakeGateway(), mailer: createFakeMailer() };
    const raw = body(paid(shopA.shopId, [line]));

    expect(await handleStripeWebhook(raw, "forged", deps)).toMatchObject({ status: 400 });
    expect(await handleStripeWebhook(raw, null, deps)).toMatchObject({ status: 400 });
    expect(await repos.sales.list()).toHaveLength(0);
  });

  it("acknowledges and ignores other event types and sessions this app did not create", async () => {
    const { shopA, repos, line } = await setup();
    const deps = { gateway: createFakeGateway(), mailer: createFakeMailer() };

    expect(await handleStripeWebhook(body(paid(shopA.shopId, [line]), "charge.succeeded"), FAKE_SIGNATURE, deps)).toMatchObject({
      status: 200,
    });
    expect(await handleStripeWebhook(body(paid(shopA.shopId, [line], { metadata: {} })), FAKE_SIGNATURE, deps)).toMatchObject({
      status: 200,
    });
    expect(await repos.sales.list()).toHaveLength(0);
  });

  it("answers 200 and records a needs_refund sale for an order of ours that does not add up", async () => {
    const { shopA, repos, phone, line } = await setup();
    const deps = { gateway: createFakeGateway(), mailer: createFakeMailer() };
    const raw = body(paid(shopA.shopId, [line], { amountTotal: 5 }));
    expect(await handleStripeWebhook(raw, FAKE_SIGNATURE, deps)).toMatchObject({ status: 200 });
    expect(await repos.sales.list()).toMatchObject([{ status: "needs_refund", total: 5 }]);
    expect((await repos.products.get(phone.id))?.stockQty).toBe(2);
    expect((await repos.emailOutbox.list()).map((e) => e.kind).sort()).toEqual(["order_issue_customer", "order_shop"]);
  });

  it("answers 200 and logs only the session id for a paid order whose shop is gone", async () => {
    const { line } = await setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = body(paid("deleted-shop", [line]));
    const result = await handleStripeWebhook(raw, FAKE_SIGNATURE, { gateway: createFakeGateway() });
    const logged = error.mock.calls.flat().map(String).join(" ");
    error.mockRestore();
    expect(result).toMatchObject({ status: 200 });
    expect(logged).toContain("cs_test_hook");
    expect(logged).not.toContain("buyer@example.com");
  });

  it("answers 200 and records nothing for a completed session that is not paid yet", async () => {
    const { shopA, repos, line } = await setup();
    const deps = { gateway: createFakeGateway(), mailer: createFakeMailer() };
    const raw = body(paid(shopA.shopId, [line], { paymentStatus: "unpaid" }));
    expect(await handleStripeWebhook(raw, FAKE_SIGNATURE, deps)).toMatchObject({ status: 200 });
    expect(await repos.sales.list()).toHaveLength(0);
    expect(await repos.emailOutbox.list()).toHaveLength(0);
  });

  it("answers 500 so Stripe retries when fulfilment fails for another reason", async () => {
    const { shopA, line } = await setup();
    const raw = body(paid(shopA.shopId, [line]));
    failure.next = true;
    try {
      expect(
        await handleStripeWebhook(raw, FAKE_SIGNATURE, { gateway: createFakeGateway(), mailer: createFakeMailer() }),
      ).toMatchObject({ status: 500 });
    } finally {
      failure.next = false;
    }
  });

  it("answers 500 with a clear message when the webhook secret is not set", async () => {
    const gateway: PaymentGateway = {
      ...createFakeGateway(),
      constructEvent: () => {
        throw new PaymentsNotConfiguredError("STRIPE_WEBHOOK_SECRET");
      },
    };
    const result = await handleStripeWebhook("{}", "sig", { gateway });
    expect(result.status).toBe(500);
    expect(result.message).toMatch(/STRIPE_WEBHOOK_SECRET is not set/);
  });
});
