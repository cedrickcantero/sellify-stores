import "server-only";
import { forShop } from "@/data";
import type { EmailKind, Mailer } from "@/domain/email";
import { createResendMailer } from "./resend";

const SEND_TIMEOUT_MS = 10_000;

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 500) || "Unknown email error.";
}

// Sends one email for a shop and records it in the shop's outbox: the row is
// written as pending first, then the mailer runs, then the row is marked
// sent or failed. Never throws, so a failed email cannot break the repair,
// buyback or order that triggered it. If the outbox row cannot be written,
// nothing is sent and the result is failed.
export async function sendEmail(
  shopId: string,
  msg: { to: string; subject: string; html: string; kind: EmailKind },
  mailer: Mailer = createResendMailer(),
  opts: { timeoutMs?: number } = {},
): Promise<{ status: "sent" | "failed" }> {
  let outbox;
  let id: string;
  try {
    outbox = forShop(shopId).emailOutbox;
    id = await outbox.record(msg);
  } catch (error) {
    console.error("Email not sent: could not write the outbox.", error);
    return { status: "failed" };
  }

  const timeoutMs = opts.timeoutMs ?? SEND_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      mailer.send({ to: msg.to, subject: msg.subject, html: msg.html }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Email provider timed out after ${timeoutMs}ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    clearTimeout(timer);
    await settle(() => outbox.markFailed(id, errorText(error)));
    return { status: "failed" };
  }
  clearTimeout(timer);
  await settle(() => outbox.markSent(id));
  return { status: "sent" };
}

// A failure to update the row must not turn a delivered email into an error.
async function settle(update: () => Promise<void>) {
  try {
    await update();
  } catch (error) {
    console.error("Could not update the outbox status.", error);
  }
}
