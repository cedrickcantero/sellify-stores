import { TabPlaceholder } from "@/store-ui";
import { requireLiveStore } from "../store-context";

// Placeholder: the product listing arrives with the Shop tab ticket.
export default async function StoreShopPage({ params }: PageProps<"/s/[slug]/shop">) {
  await requireLiveStore((await params).slug, "shop");
  return <TabPlaceholder title="Shop" text="Products will appear here soon." />;
}
