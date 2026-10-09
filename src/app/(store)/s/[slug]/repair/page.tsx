import { TabPlaceholder } from "@/store-ui";
import { requireLiveStore } from "../store-context";

// Placeholder: repair booking arrives with the Repair tab ticket.
export default async function StoreRepairPage({ params }: PageProps<"/s/[slug]/repair">) {
  await requireLiveStore((await params).slug, "repair");
  return <TabPlaceholder title="Repair" text="Repair booking will appear here soon." />;
}
