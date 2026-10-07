import type { Metadata } from "next";
import { PageHeader } from "@/ui";

export const metadata: Metadata = { title: "Buybacks | Sellify" };

// Placeholder. The page content arrives in the Buybacks ticket.
export default function BuybacksPage() {
  return <PageHeader title="Buybacks" description="Buyback prices and accepted buyback quotes." />;
}
