import type { Metadata } from "next";
import { getActiveShop } from "@/auth/session";
import { forShop } from "@/data";
import { emailKindLabel } from "@/domain/email";
import { PageHeader } from "@/ui";
import { OutboxTable, type OutboxRow } from "./outbox-table";

export const metadata: Metadata = { title: "Email outbox | Sellify" };

export default async function EmailOutboxPage() {
  const { shopId, shop } = await getActiveShop();
  const emails = await forShop(shopId).emailOutbox.list();

  const format = new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: shop.timezone,
  });
  const rows: OutboxRow[] = emails.map((email) => ({
    id: email.id,
    kindLabel: emailKindLabel(email.kind),
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    status: email.status,
    error: email.error,
    sentAt: format.format(email.createdAt),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email outbox"
        description="Every email Sellify sent for your shop, and whether it arrived."
      />
      <OutboxTable rows={rows} />
    </div>
  );
}
