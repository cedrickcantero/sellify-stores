import type { Metadata } from "next";
import { headers } from "next/headers";
import { getActiveShop } from "@/auth/session";
import { hostEnv, storeAddress } from "@/domain/store-host";
import { getStoreSettings, hasUnpublishedChanges } from "@/services/store";
import { PageHeader } from "@/ui";
import { StoreEditor } from "./store-editor";

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
  const origin = await currentOrigin();
  const address = storeAddress(shop.slug, { storeRootDomain: hostEnv().storeRootDomain, origin });
  // A preview is opened on this (app) host, where the owner is signed in.
  const previewUrl = `${origin}/s/${shop.slug}?preview`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Online Store" description="Set up and publish your online store." />
      <StoreEditor
        draft={settings.draft}
        address={address}
        previewUrl={previewUrl}
        published={settings.published}
        online={settings.online}
        unpublishedChanges={await hasUnpublishedChanges(shopId)}
      />
    </div>
  );
}
