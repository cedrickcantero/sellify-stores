import type { Metadata } from "next";
import { PageHeader } from "@/ui";

export const metadata: Metadata = { title: "Email outbox | Sellify" };

// Placeholder. The page content arrives in the Email outbox ticket.
export default function EmailOutboxPage() {
  return <PageHeader title="Email outbox" description="Every email Sellify sent for your shop, and whether it arrived." />;
}
