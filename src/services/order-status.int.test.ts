import { describe, expect, it } from "vitest";
import { forShop } from "@/data";
import { createFakeMailer } from "@/email";
import { encodeOrderMetadata } from "@/domain/order-metadata";
import type { PaidSession } from "@/payments/gateway";
import { createFakeGateway } from "@/test/fake-gateway";
import { seedTwoShops } from "@/test/seed";
import { fulfilOrder } from "./fulfil-order";
import { getOrderStatus } from "./order-status";

async function setup() {
  const { shopA, shopB } = await seedTwoShops();
  const phone = await forShop(shopA.shopId).products.create({
    title: "Pixel",
    kind: "phone",
    condition: "good",
    price: 20000,
    stockQty: 2,
    images: [],
    deviceModelId: null,
  });
  const line = { productId: phone.id, qty: 1, unitPrice: 20000 };
  const session: PaidSession = {
    id: "cs_test_status",
    metadata: encodeOrderMetadata(shopA.shopId, [line]),
    clientReferenceId: shopA.shopId,
    customerEmail: "buyer@example.com",
    paymentStatus: "paid",
    amountTotal: 20000,
  };
  const gateway = createFakeGateway();
  gateway.sessions.set(session.id, session);
  return { shopA, shopB, session, gateway };
}

describe("getOrderStatus", () => {
  it("is pending while Stripe says paid but the webhook has not recorded the sale", async () => {
    const { shopA, session, gateway } = await setup();
    expect(await getOrderStatus(shopA.shopId, session.id, { gateway })).toEqual({ state: "pending" });
  });

  it("shows the recorded sale once the webhook has run, without asking Stripe", async () => {
    const { shopA, session } = await setup();
    await fulfilOrder(session, { mailer: createFakeMailer() });
    const never = createFakeGateway();
    never.retrieveSession = async () => {
      throw new Error("should not be called");
    };
    const status = await getOrderStatus(shopA.shopId, session.id, { gateway: never });
    expect(status).toMatchObject({
      state: "confirmed",
      sale: { status: "completed", total: 20000, items: [{ title: "Pixel", quantity: 1 }] },
    });
  });

  it("is unknown for an id Stripe does not know, an unpaid session and another shop's order", async () => {
    const { shopA, shopB, session, gateway } = await setup();
    expect(await getOrderStatus(shopA.shopId, "cs_test_nope", { gateway })).toEqual({ state: "unknown" });
    gateway.sessions.set(session.id, { ...session, paymentStatus: "unpaid" });
    expect(await getOrderStatus(shopA.shopId, session.id, { gateway })).toEqual({ state: "unknown" });
    gateway.sessions.set(session.id, session);
    // Shop B asks about shop A's session, before and after it is recorded.
    expect(await getOrderStatus(shopB.shopId, session.id, { gateway })).toEqual({ state: "unknown" });
    await fulfilOrder(session, { mailer: createFakeMailer() });
    expect(await getOrderStatus(shopB.shopId, session.id, { gateway })).toEqual({ state: "unknown" });
  });

  it("is unknown without a session id", async () => {
    const { shopA, gateway } = await setup();
    expect(await getOrderStatus(shopA.shopId, undefined, { gateway })).toEqual({ state: "unknown" });
  });
});
