import Link from "next/link";
import { WEEKDAYS, type StoreConfig, type Weekday } from "@/domain/store-config";
import { STORE_TABS, storeHref } from "./store-shell";

const TAB_BLURBS = {
  shop: "Phones and accessories in stock now.",
  repair: "See our price and book a time.",
  sell: "Get an offer for your phone.",
} as const;

const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function OpeningHours({ hours }: { hours: StoreConfig["openingHours"] }) {
  return (
    <section aria-labelledby="store-hours" className="flex flex-col gap-3">
      <h2 id="store-hours" className="font-(family-name:--store-font-heading) text-2xl font-bold">
        Opening hours
      </h2>
      <dl className="grid max-w-sm grid-cols-[auto_1fr] gap-x-8 gap-y-1">
        {WEEKDAYS.map((day) => {
          const value = hours[day];
          return (
            <div key={day} className="contents">
              <dt className="font-semibold">{WEEKDAY_NAMES[day]}</dt>
              <dd>{value ? `${value.open} to ${value.close}` : "Closed"}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

// Store home page: the store name, a card for each enabled tab, the about
// text and the opening hours. Everything comes from the published config
// (or the draft in a preview) and is styled with var(--store-*) only.
export function StoreHome({
  config,
  basePath,
  preview = false,
}: {
  config: StoreConfig;
  basePath: string;
  preview?: boolean;
}) {
  const tabs = STORE_TABS.filter((tab) => config.tabs[tab.key]);
  const about = config.content.about.trim();

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-(family-name:--store-font-heading) text-4xl font-bold">{config.brand.name}</h1>
      {tabs.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={storeHref(basePath, tab.path, preview)}
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
      {about ? (
        <section aria-labelledby="store-about" className="flex max-w-prose flex-col gap-3">
          <h2 id="store-about" className="font-(family-name:--store-font-heading) text-2xl font-bold">
            About us
          </h2>
          <p className="whitespace-pre-line">{about}</p>
        </section>
      ) : null}
      <OpeningHours hours={config.openingHours} />
    </div>
  );
}
