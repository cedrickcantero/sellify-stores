import {
  InvalidWebhookError,
  type NewSession,
  type PaidSession,
  type PaymentEvent,
  type PaymentGateway,
} from "@/payments/gateway";

export const FAKE_SIGNATURE = "valid-signature";

export type FakeGateway = PaymentGateway & {
  /** Every session created, in order. */
  readonly created: NewSession[];
  /** What the provider knows, by session id (the success page reads it). */
  readonly sessions: Map<string, PaidSession>;
};

// A payment provider for tests: remembers created sessions, accepts only
// FAKE_SIGNATURE and reads the raw body as the JSON event.
export function createFakeGateway(): FakeGateway {
  const created: NewSession[] = [];
  const sessions = new Map<string, PaidSession>();
  return {
    created,
    sessions,
    async createSession(input) {
      created.push(input);
      const id = `cs_test_fake${created.length}`;
      sessions.set(id, {
        id,
        metadata: input.metadata,
        clientReferenceId: input.clientReferenceId,
        customerEmail: null,
        paymentStatus: "unpaid",
        amountTotal: input.lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0),
      });
      return { id, url: `https://checkout.example.test/${id}` };
    },
    constructEvent(rawBody, signature): PaymentEvent {
      if (signature !== FAKE_SIGNATURE) throw new InvalidWebhookError();
      return JSON.parse(rawBody) as PaymentEvent;
    },
    async retrieveSession(id) {
      return sessions.get(id) ?? null;
    },
  };
}
