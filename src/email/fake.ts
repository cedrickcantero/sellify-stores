import type { EmailMessage, Mailer } from "@/domain/email";

export type FakeMailer = Mailer & {
  /** Every message the mailer delivered, in order. */
  readonly sent: EmailMessage[];
};

// A mailer for tests: delivers nothing, remembers what it was given, and
// rejects every send when `fail` is true.
export function createFakeMailer(opts: { fail?: boolean } = {}): FakeMailer {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(msg) {
      if (opts.fail) throw new Error("Fake mailer failure.");
      sent.push({ to: msg.to, subject: msg.subject, html: msg.html });
    },
  };
}
