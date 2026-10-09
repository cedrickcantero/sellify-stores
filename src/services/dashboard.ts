import "server-only";
import { forShop, type BuybackQuoteListItem, type RepairTicket } from "@/data";
import { shopDayBounds } from "@/domain/shop-day";
import { hostEnv, storeAddress } from "@/domain/store-host";
import { getStorefront } from "./store";

// The numbers and lists on the backend dashboard. The shop id comes from the
// server session, never from the browser.

const UPCOMING_REPAIRS = 5;

export type DashboardSummary = {
  /** Completed sales from today in the shop's timezone. Total in cents. */
  salesToday: { count: number; total: number };
  /** The next booked repairs from now, soonest first (at most five). */
  upcomingRepairs: RepairTicket[];
  /** Accepted buyback quotes the shop has not yet received, newest first. */
  pendingBuybacks: BuybackQuoteListItem[];
  /** The address is set only while the store is online. */
  store: { online: boolean; address: string | null };
};

export async function getDashboardSummary(
  shopId: string,
  opts: { now?: Date; origin?: string } = {},
): Promise<DashboardSummary> {
  const now = opts.now ?? new Date();
  const repos = forShop(shopId);
  const shop = await repos.shop.get();
  if (!shop) throw new Error(`No shop ${shopId}`);
  const { start, end } = shopDayBounds(now, shop.timezone);

  const [sales, upcomingRepairs, pendingBuybacks, storefront] = await Promise.all([
    repos.sales.totals({ status: "completed", since: start, until: end }),
    repos.repairs.listTickets({
      status: "booked",
      from: now,
      limit: UPCOMING_REPAIRS,
    }),
    repos.buybacks.listQuotes({ statuses: ["accepted"] }),
    getStorefront(shopId, { preview: false }),
  ]);

  const storeRootDomain = hostEnv().storeRootDomain;
  const online = storefront.status === "live";
  return {
    salesToday: sales,
    upcomingRepairs,
    pendingBuybacks,
    store: {
      online,
      address:
        online && (storeRootDomain || opts.origin)
          ? storeAddress(shop.slug, {
              storeRootDomain,
              origin: opts.origin ?? "",
            })
          : null,
    },
  };
}
