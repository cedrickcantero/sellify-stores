import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ORDER_PAGE_HEADER } from "@/domain/store-host";
import { readBuyableCart } from "@/services/cart";
import { StoreOffline, StoreOrderShell, StoreShell } from "@/store-ui";
import { loadStore } from "./store-context";

// Every store page renders inside the shell of the store resolved for this
// request: not found for an unknown address, the branded offline page when
// the store is switched off or was never published.
export async function generateMetadata({ params }: LayoutProps<"/s/[slug]">): Promise<Metadata> {
  const store = await loadStore((await params).slug);
  if (!store) return {};
  const brand = store.storefront.status === "live" ? store.storefront.config.brand : store.storefront.brand;
  return {
    title: brand.name,
    description: store.storefront.status === "live" ? store.storefront.config.content.about.slice(0, 160) : undefined,
    // Previews and the offline page must not be indexed.
    robots: store.preview || store.storefront.status === "offline" ? { index: false, follow: false } : undefined,
  };
}

export default async function StoreLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  const store = await loadStore((await params).slug);
  if (!store) notFound();
  if (store.storefront.status === "offline") {
    // Only the proxy sets this header, and only on the order confirmation page.
    if ((await headers()).get(ORDER_PAGE_HEADER) === "1") {
      return <StoreOrderShell brand={store.storefront.brand}>{children}</StoreOrderShell>;
    }
    return <StoreOffline brand={store.storefront.brand} />;
  }

  const basketCount = store.storefront.config.tabs.shop
    ? (await readBuyableCart(store.shopId)).reduce((sum, line) => sum + line.qty, 0)
    : undefined;

  return (
    <StoreShell
      config={store.storefront.config}
      basePath={store.basePath}
      preview={store.preview}
      basketCount={basketCount}
    >
      {children}
    </StoreShell>
  );
}
