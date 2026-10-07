import type { Metadata } from "next";
import { PageHeader } from "@/ui";

export const metadata: Metadata = { title: "Inventory | Sellify" };

// Placeholder. The page content arrives in the Inventory ticket.
export default function InventoryPage() {
  return <PageHeader title="Inventory" description="Your phones and accessories, with stock and photos." />;
}
