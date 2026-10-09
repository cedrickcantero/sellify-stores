import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getSessionUserId } from "@/auth/session";
import type { StoreConfig } from "@/domain/store-config";
import { PREVIEW_HEADER, STORE_HOST_SEGMENT } from "@/domain/store-host";
import { getStorefront, resolveStore, type ResolvedStore, type Storefront } from "@/services/store";

export type StoreContext = ResolvedStore & { storefront: Storefront; preview: boolean };

// The store for this request, resolved once per request and shared by the
// store layout and its pages. The shop comes from the real request host
// and the [slug] segment (see proxy.ts), never from the browser.
// Null when the address matches no store.
export const loadStore = cache(async (slug: string): Promise<StoreContext | null> => {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  // /s/_host/... is a store host request rewritten by the proxy: resolve by
  // host. Anything else is the /s/<slug> address.
  const pathname = slug === STORE_HOST_SEGMENT ? "/" : `/s/${encodeURIComponent(slug)}`;
  const store = await resolveStore(host, pathname);
  if (!store) return null;

  const preview = requestHeaders.get(PREVIEW_HEADER) === "1";
  const userId = preview ? ((await getSessionUserId()) ?? undefined) : undefined;
  const storefront = await getStorefront(store.shopId, { preview, userId });
  return { ...store, storefront, preview: storefront.status === "live" && storefront.draft === true };
});

// For store pages: the live store, or a 404 when the address matches no
// store or the store is offline (the layout shows the offline page then).
// Pass `tab` to also 404 when that tab is switched off.
export async function requireLiveStore(
  slug: string,
  tab?: keyof StoreConfig["tabs"],
): Promise<StoreContext & { storefront: { status: "live"; config: StoreConfig } }> {
  const store = await loadStore(slug);
  if (!store || store.storefront.status !== "live") notFound();
  if (tab && !store.storefront.config.tabs[tab]) notFound();
  return store as StoreContext & { storefront: { status: "live"; config: StoreConfig } };
}
