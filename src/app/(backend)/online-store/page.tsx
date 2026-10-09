import type { Metadata } from "next";
import { headers } from "next/headers";
import { getActiveShop } from "@/auth/session";
import { hostEnv, storeAddress } from "@/domain/store-host";
import { getStoreSettings } from "@/services/store";
import { PageHeader } from "@/ui";
import { StoreDetailsForm } from "./store-details-form";
import { StoreStatusCard } from "./store-status-card";

export const metadata: Metadata = { title: "Online Store | Sellify" };

// The live address shown to the owner: the store subdomain when a store
// root domain is configured, otherwise /s/<slug> on this host.
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? "http";
  return `${proto}://${h.get("host") ?? "localhost:3000"}`;
}

export default async function OnlineStorePage() {
  const { shopId, shop } = await getActiveShop();
  const settings = await getStoreSettings(shopId);
  const address = storeAddress(shop.slug, {
    storeRootDomain: hostEnv().storeRootDomain,
    origin: await currentOrigin(),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Online Store" description="Set up and publish your online store." />
      <StoreStatusCard address={address} published={settings.published} online={settings.online} />
      <StoreDetailsForm name={settings.draft.brand.name} logoUrl={settings.draft.brand.logoUrl} />
    </div>
  );
}
