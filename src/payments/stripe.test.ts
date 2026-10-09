import Stripe from "stripe";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidWebhookError, PaymentsNotConfiguredError } from "./gateway";
import { createStripeGateway } from "./stripe";

// Offline: signs a payload with the SDK's own test helper and a throwaway
// secret, so the real signature check runs without any Stripe account.
const SECRET = "unit-test-signing-secret";
const OLD = { key: process.env.STRIPE_SECRET_KEY, hook: process.env.STRIPE_WEBHOOK_SECRET };

afterEach(() => {
  for (const [name, value] of [["STRIPE_SECRET_KEY", OLD.key], ["STRIPE_WEBHOOK_SECRET", OLD.hook]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const body = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_1",
      object: "checkout.session",
      metadata: { app: "sellify-stores", shopId: "s1", lines: "p1:1:100" },
      client_reference_id: "s1",
      customer_details: { email: "buyer@example.com" },
      payment_status: "paid",
      amount_total: 100,
    },
  },
});
const sign = (payload: string) => new Stripe("x").webhooks.generateTestHeaderString({ payload, secret: SECRET });

describe("stripe gateway", () => {
  it("creating the gateway needs no keys, using it does", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const gateway = createStripeGateway();
    expect(() => gateway.constructEvent(body, "sig")).toThrow(PaymentsNotConfiguredError);
    await expect(gateway.retrieveSession("cs_test_1")).rejects.toThrow(/STRIPE_SECRET_KEY is not set/);
  });

  it("accepts a correctly signed raw body and maps the session", () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const event = createStripeGateway().constructEvent(body, sign(body));
    expect(event).toEqual({
      id: "evt_1",
      type: "checkout.session.completed",
      session: {
        id: "cs_test_1",
        metadata: { app: "sellify-stores", shopId: "s1", lines: "p1:1:100" },
        clientReferenceId: "s1",
        customerEmail: "buyer@example.com",
        paymentStatus: "paid",
        amountTotal: 100,
      },
    });
  });

  it("rejects a body changed after signing, a wrong secret and a missing header", () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const gateway = createStripeGateway();
    const header = sign(body);
    expect(() => gateway.constructEvent(body.replace("100", "1"), header)).toThrow(InvalidWebhookError);
    expect(() => gateway.constructEvent(body, null)).toThrow(InvalidWebhookError);
    process.env.STRIPE_WEBHOOK_SECRET = "another-secret";
    expect(() => gateway.constructEvent(body, header)).toThrow(InvalidWebhookError);
  });
});
