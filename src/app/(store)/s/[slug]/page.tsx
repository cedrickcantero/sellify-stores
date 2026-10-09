import Link from "next/link";
import { STORE_TABS, storeHref } from "@/store-ui";
import { requireLiveStore } from "./store-context";

const TAB_BLURBS = {
  shop: "Phones and accessories in stock now.",
  repair: "See our price and book a time.",
  sell: "Get an offer for your phone.",
} as const;

// Store home page. The banner, about text and opening hours arrive with the
// store editor; this shows the store name and its enabled tabs.
export default async function StoreHomePage({ params }: PageProps<"/s/[slug]">) {
  const { storefront, basePath } = await requireLiveStore((await params).slug);
  const { config } = storefront;
  const tabs = STORE_TABS.filter((tab) => config.tabs[tab.key]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-(family-name:--store-font-heading) text-4xl font-bold">{config.brand.name}</h1>
      {tabs.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={storeHref(basePath, tab.path)}
                className="flex h-full flex-col gap-2 rounded-(--store-radius) border border-(--store-text)/15 p-6 hover:border-(--store-primary)"
              >
                <span className="font-(family-name:--store-font-heading) text-xl font-bold text-(--store-primary)">
                  {tab.label}
                </span>
                <span>{TAB_BLURBS[tab.key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
