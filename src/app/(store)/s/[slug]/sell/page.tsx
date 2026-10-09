import { TabPlaceholder } from "@/store-ui";
import { requireLiveStore } from "../store-context";

// Placeholder: buyback quotes arrive with the Sell tab ticket.
export default async function StoreSellPage({ params }: PageProps<"/s/[slug]/sell">) {
  await requireLiveStore((await params).slug, "sell");
  return <TabPlaceholder title="Sell" text="Phone buyback offers will appear here soon." />;
}
