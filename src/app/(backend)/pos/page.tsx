import type { Metadata } from "next";
import { PageHeader } from "@/ui";

export const metadata: Metadata = { title: "POS | Sellify" };

// Placeholder. The page content arrives in the POS sale ticket.
export default function PosPage() {
  return <PageHeader title="POS" description="Ring up an in-shop sale." />;
}
