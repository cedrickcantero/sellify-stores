import type { Metadata } from "next";
import { PageHeader } from "@/ui";

export const metadata: Metadata = { title: "Repairs | Sellify" };

// Placeholder. The page content arrives in the Repairs ticket.
export default function RepairsPage() {
  return <PageHeader title="Repairs" description="Repair prices and repair tickets, including online bookings." />;
}
