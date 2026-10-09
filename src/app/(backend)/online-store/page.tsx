import type { Metadata } from "next";
import { getActiveShop } from "@/auth/session";
import { hostEnv, storeAddress } from "@/domain/store-host";
import { getStoreSettings, hasUnpublishedChanges } from "@/services/store";
import { PageHeader } from "@/ui";
import { currentOrigin } from "../current-origin";
import { StoreEditor } from "./store-editor";

export const metadata: Metadata = { title: "Online Store | Sellify" };

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
