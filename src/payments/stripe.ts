import "server-only";
import Stripe from "stripe";
import {
  InvalidWebhookError,
  type NewSession,
  PaymentsNotConfiguredError,
  type PaidSession,
  type PaymentEvent,
  type PaymentGateway,
} from "./gateway";

// The Stripe adapter. Keys are read when a call needs them, never at import
// or start-up, so a missing key fails only checkout or the webhook.

function requireEnv(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new PaymentsNotConfiguredError(name);
  return value;
}

let client: { key: string; stripe: Stripe } | undefined;
function stripe(): Stripe {
  const key = requireEnv("STRIPE_SECRET_KEY");
  if (client?.key !== key) client = { key, stripe: new Stripe(key) };
  return client.stripe;
}

function toSession(session: Stripe.Checkout.Session): PaidSession {
  return {
    id: session.id,
    metadata: { ...(session.metadata ?? {}) },
    clientReferenceId: session.client_reference_id ?? null,
    customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
    paymentStatus: session.payment_status === "paid" ? "paid" : "unpaid",
    amountTotal: session.amount_total ?? null,
  };
}

// Card only. Delayed methods (bank debits and transfers) send
// checkout.session.completed before the money has arrived, with
// payment_status "unpaid"; fulfilling then would hand over goods unpaid. The
// webhook also ignores any unpaid completed session as a second guard.
export function buildSessionParams(input: NewSession): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    allowed_payment_method_types: ["card"],
    client_reference_id: input.clientReferenceId,
    metadata: input.metadata,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: input.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: input.currency,
        unit_amount: line.unitAmount,
        product_data: { name: line.name.slice(0, 250) },
      },
    })),
  };
}

export function createStripeGateway(): PaymentGateway {
  return {
    async createSession(input) {
      const session = await stripe().checkout.sessions.create(buildSessionParams(input));
      if (!session.url) throw new Error("Stripe returned a Checkout session without a url.");
      return { id: session.id, url: session.url };
    },

    constructEvent(rawBody, signature): PaymentEvent {
      const secret = requireEnv("STRIPE_WEBHOOK_SECRET");
      if (!signature) throw new InvalidWebhookError("Missing Stripe signature.");
      let event: Stripe.Event;
      try {
        event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
      } catch {
        throw new InvalidWebhookError();
      }
      const object = event.data.object as { object?: string };
      const session = object.object === "checkout.session" ? toSession(object as Stripe.Checkout.Session) : null;
      return { id: event.id, type: event.type, session };
    },

    async retrieveSession(id) {
      try {
        return toSession(await stripe().checkout.sessions.retrieve(id));
      } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) return null;
        throw error;
      }
    },
  };
}

let gateway: PaymentGateway | undefined;
/** The shared gateway used by checkout, the webhook and the success page. */
export function getPaymentGateway(): PaymentGateway {
  gateway ??= createStripeGateway();
  return gateway;
}
