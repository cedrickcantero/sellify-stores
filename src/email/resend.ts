import { Resend } from "resend";
import type { Mailer } from "@/domain/email";

// Sends through Resend. Configuration is read when a message is sent, not
// when the mailer is created, so a missing key makes that send fail (and the
// outbox record `failed`) instead of breaking anything at import time.
export function createResendMailer(): Mailer {
  return {
    async send(msg) {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!apiKey) throw new Error("Email is not set up: RESEND_API_KEY is not set.");
      if (!from) throw new Error("Email is not set up: EMAIL_FROM is not set.");

      const { error } = await new Resend(apiKey).emails.send({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      });
      if (error) throw new Error(`Resend rejected the email: ${error.message}`);
    },
  };
}
