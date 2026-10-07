import type { Metadata } from "next";
import { PageHeader } from "@/ui";

export const metadata: Metadata = { title: "Sales | Sellify" };

// Placeholder. The page content arrives in the Sales ticket.
export default function SalesPage() {
  return <PageHeader title="Sales" description="Every POS and online sale, with its channel and status." />;
}
