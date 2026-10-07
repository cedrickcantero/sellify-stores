import type { Metadata } from "next";
import { PageHeader } from "@/ui";

export const metadata: Metadata = { title: "Online Store | Sellify" };

// Placeholder. The page content arrives in the Online Store ticket.
export default function OnlineStorePage() {
  return <PageHeader title="Online Store" description="Set up, preview and publish your online store." />;
}
