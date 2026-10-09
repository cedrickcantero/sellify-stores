import "server-only";
import type { Mailer } from "@/domain/email";
import { ORDER_APP } from "@/domain/order-metadata";
import { InvalidWebhookError, PaymentsNotConfiguredError, type PaymentGateway } from "@/payments/gateway";
import { getPaymentGateway } from "@/payments/stripe";
import { fulfilOrder, InvalidOrderError } from "./fulfil-order";

// The webhook's logic, kept apart from the route so tests can call it. The
// route passes the raw request text: the signature covers those exact bytes.
// 200 means Stripe stops retrying (handled, or not ours); 400 is a bad
// signature or an order that cannot be fulfilled; 500 asks Stripe to retry.
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  deps: { gateway?: PaymentGateway; mailer?: Mailer } = {},
): Promise<{ status: 200 | 400 | 500; message: string }> {
  const gateway = deps.gateway ?? getPaymentGateway();
  let event;
  try {
    event = gateway.constructEvent(rawBody, signature);
  } catch (error) {
    if (error instanceof InvalidWebhookError) return { status: 400, message: error.message };
    if (error instanceof PaymentsNotConfiguredError) {
      console.error(error.message);
      return { status: 500, message: error.message };
    }
    throw error;
  }

  if (event.type !== "checkout.session.completed" || !event.session) {
    return { status: 200, message: "Event ignored." };
  }
  if (event.session.metadata.app !== ORDER_APP) return { status: 200, message: "Not a Sellify order." };

  try {
    await fulfilOrder(event.session, { mailer: deps.mailer });
    return { status: 200, message: "OK" };
  } catch (error) {
    if (error instanceof InvalidOrderError) {
      console.error(error.message, { session: event.session.id });
      return { status: 400, message: error.message };
    }
    console.error("Fulfilling an order failed.", error);
    return { status: 500, message: "Could not fulfil the order." };
  }
}
