import "server-only";
import { forShop, type BuybackQuoteListItem, type RepairTicket } from "@/data";
import { shopDayBounds } from "@/domain/shop-day";
import { hostEnv, storeAddress } from "@/domain/store-host";

// The numbers and lists on the backend dashboard. The shop id comes from the
// server session, never from the browser.

const LIST_LENGTH = 5;

export type DashboardSummary = {
  /** Completed sales from today in the shop's timezone. Total in cents. */
  salesToday: { count: number; total: number };
  /** The next booked repairs from now, soonest first (at most five). */
  upcomingRepairs: RepairTicket[];
  /** How many booked repairs are upcoming, including the five listed. */
  upcomingRepairCount: number;
  /** The newest accepted buyback quotes not yet received (at most five). */
  pendingBuybacks: BuybackQuoteListItem[];
  /** How many accepted quotes are waiting, including the five listed. */
  pendingBuybackCount: number;
  /**
   * `published` is whether the store was ever published. The address is set
   * only while the store is online.
   */
  store: { online: boolean; published: boolean; address: string | null };
};

export async function getDashboardSummary(
  shopId: string,
  opts: { now?: Date; origin?: string; shop?: { slug: string; timezone: string } } = {},
): Promise<DashboardSummary> {
  const now = opts.now ?? new Date();
  const repos = forShop(shopId);
  // A caller that already has the shop (the page) passes it to skip the lookup.
  const shop = opts.shop ?? (await repos.shop.get());
  if (!shop) throw new Error(`No shop ${shopId}`);
  const { start, end } = shopDayBounds(now, shop.timezone);

  const upcoming = { status: "booked", from: now } as const;
  const [
    sales,
    upcomingRepairs,
    upcomingRepairCount,
    pendingBuybacks,
    pendingBuybackCount,
    storeRow,
  ] = await Promise.all([
    repos.sales.totals({ status: "completed", since: start, until: end }),
    repos.repairs.listTickets({ ...upcoming, limit: LIST_LENGTH }),
    repos.repairs.countTickets(upcoming),
    repos.buybacks.listQuotes({ statuses: ["accepted"], limit: LIST_LENGTH }),
    repos.buybacks.countQuotes({ statuses: ["accepted"] }),
    repos.storeConfig.get(),
  ]);

  const storeRootDomain = hostEnv().storeRootDomain;
  const published = storeRow?.published != null;
  const online = published && storeRow?.online === true;
  return {
    salesToday: sales,
    upcomingRepairs,
    upcomingRepairCount,
    pendingBuybacks,
    pendingBuybackCount,
    store: {
      online,
      published,
      address:
        online && (storeRootDomain || opts.origin)
          ? storeAddress(shop.slug, { storeRootDomain, origin: opts.origin ?? "" })
          : null,
    },
  };
}
