import type { Metadata } from "next";
import { PageHeader } from "@/ui";

export const metadata: Metadata = { title: "Dashboard | Sellify" };

// Placeholder. The dashboard summary arrives in the Dashboard ticket.
export default function DashboardPage() {
  return (
    <PageHeader
      title="Dashboard"
      description="Today's sales, upcoming repairs, pending buybacks and your store status."
    />
  );
}
