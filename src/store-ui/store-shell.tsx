import Link from "next/link";
import type { ReactNode } from "react";
import type { StoreConfig } from "@/domain/store-config";
import { StoreTheme } from "./store-theme";

export type StoreTab = { key: keyof StoreConfig["tabs"]; label: string; path: string };

export const STORE_TABS: StoreTab[] = [
  { key: "shop", label: "Shop", path: "/shop" },
  { key: "repair", label: "Repair", path: "/repair" },
  { key: "sell", label: "Sell", path: "/sell" },
];

export function storeHref(basePath: string, path: string): string {
  return `${basePath}${path}` || "/";
}

function StoreLogo({ brand }: { brand: StoreConfig["brand"] }) {
  if (!brand.logoUrl) return null;
  // Logos are rendered only through <img>, so an uploaded SVG cannot run
  // script (it is also sanitised when uploaded).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={brand.logoUrl} alt="" className="h-10 w-auto max-w-40 object-contain" />;
}

// The store surface layout: header with the store's name and logo, a nav of
// only the enabled tabs, the page, and a footer with the contact details.
// Styled only from the config's brand settings.
export function StoreShell({
  config,
  basePath,
  preview = false,
  children,
}: {
  config: StoreConfig;
  /** "/s/<slug>" on the path address, "" on a store host. */
  basePath: string;
  /** Shows a notice that this is the owner's unpublished draft. */
  preview?: boolean;
  children: ReactNode;
}) {
  const { brand, contact } = config;
  const tabs = STORE_TABS.filter((tab) => config.tabs[tab.key]);
  const contactLines = [contact.address, contact.phone, contact.email].filter(Boolean);

  return (
    <StoreTheme brand={brand}>
      {preview ? (
        <p className="bg-(--store-text) px-4 py-2 text-center text-sm text-(--store-bg)">
          Preview of your draft. Customers see your published store.
        </p>
      ) : null}
      <header className="border-b border-(--store-text)/15">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={storeHref(basePath, "/")} className="flex min-w-0 items-center gap-3">
            <StoreLogo brand={brand} />
            <span className="truncate font-(family-name:--store-font-heading) text-xl font-bold">{brand.name}</span>
          </Link>
          {tabs.length > 0 ? (
            <nav aria-label="Store">
              <ul className="flex gap-1">
                {tabs.map((tab) => (
                  <li key={tab.key}>
                    <Link
                      href={storeHref(basePath, tab.path)}
                      className="inline-flex h-10 items-center rounded-(--store-radius) px-4 font-semibold hover:bg-(--store-primary) hover:text-(--store-on-primary)"
                    >
                      {tab.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-(--store-text)/15">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:justify-between sm:px-6">
          <p className="font-semibold">{brand.name}</p>
          {contactLines.length > 0 ? (
            <address className="flex flex-col gap-1 not-italic sm:items-end">
              {contact.address ? <span>{contact.address}</span> : null}
              {contact.phone ? <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a> : null}
              {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
            </address>
          ) : null}
        </div>
      </footer>
    </StoreTheme>
  );
}

// Shown when the shop exists but its store is switched off or was never
// published. Uses the last published brand (or the shop's name).
export function StoreOffline({ brand }: { brand: StoreConfig["brand"] }) {
  return (
    <StoreTheme brand={brand}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <StoreLogo brand={brand} />
        <h1 className="font-(family-name:--store-font-heading) text-3xl font-bold">{brand.name}</h1>
        <p className="text-lg">Our online store is offline right now.</p>
        <p className="text-(--store-text)/75">Check back soon, or visit us in the shop.</p>
      </main>
    </StoreTheme>
  );
}
