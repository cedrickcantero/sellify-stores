// The payment provider seen from the app: three calls and plain data. Tests
// use a fake; production uses the Stripe adapter in ./stripe.ts.

export type PaidSession = {
  id: string;
  metadata: Record<string, string>;
  clientReferenceId: string | null;
  customerEmail: string | null;
  paymentStatus: "paid" | "unpaid";
  /** Total charged, in cents. */
  amountTotal: number | null;
};

export type PaymentEvent = { id: string; type: string; session: PaidSession | null };

export type NewSession = {
  currency: string;
  lines: { name: string; unitAmount: number; quantity: number }[];
  metadata: Record<string, string>;
  clientReferenceId: string;
  successUrl: string;
  cancelUrl: string;
};

export interface PaymentGateway {
  createSession(input: NewSession): Promise<{ id: string; url: string }>;
  /** Verifies the signature against the raw body; throws when it does not match. */
  constructEvent(rawBody: string, signature: string | null): PaymentEvent;
  /** A session by id, or null when the provider does not know it. */
  retrieveSession(id: string): Promise<PaidSession | null>;
}

/** The provider keys are not set, so checkout and the webhook cannot work. */
export class PaymentsNotConfiguredError extends Error {
  constructor(variable: string) {
    super(`${variable} is not set. Add your Stripe test-mode key to .env.local to use checkout.`);
    this.name = "PaymentsNotConfiguredError";
  }
}

/** The webhook signature or body was not valid. */
export class InvalidWebhookError extends Error {
  constructor(message = "Invalid webhook signature.") {
    super(message);
    this.name = "InvalidWebhookError";
  }
}
