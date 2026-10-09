import "server-only";
import { forShop, inTransaction, SlotTakenError } from "@/data";
import type { Mailer } from "@/domain/email";
import { safeHtml } from "@/domain/email-html";
import { formatCents } from "@/domain/product";
import { bookingWindow, formatSlotLabel, generateSlots, slotDate } from "@/domain/repair-slots";
import { err, ok, type Result } from "@/domain/result";
import type { StoreConfig } from "@/domain/store-config";
import { sendEmail } from "@/email";
import { getStorefront } from "./store";

// Online repair booking: the free slots of a day for one repair, and booking
// one. The shop id always comes from the server (requireLiveStore); the
// browser only names a repair price and a slot, and both are checked against
// this shop's published config and prices.

const DAY_MS = 24 * 60 * 60 * 1000;

type Customer = { name: string; phone: string; email: string };

type Offer = {
  config: StoreConfig;
  timezone: string;
  price: NonNullable<Awaited<ReturnType<ReturnType<typeof forShop>["repairs"]["getPrice"]>>>;
};

// The published config and price, or null when customers cannot book this
// repair: store offline or unpublished, Repair tab off, or a price that is
// not this shop's.
async function loadOffer(shopId: string, repairPriceId: string): Promise<Offer | null> {
  const storefront = await getStorefront(shopId, { preview: false });
  if (storefront.status !== "live" || !storefront.config.tabs.repair) return null;
  const repos = forShop(shopId);
  const [price, shop] = await Promise.all([repos.repairs.getPrice(repairPriceId), repos.shop.get()]);
  if (!price || !shop) return null;
  return { config: storefront.config, timezone: shop.timezone, price };
}

function slotsFor(offer: Offer, date: string, now: Date, bookedCounts: Map<string, number>): string[] {
  const { first, last } = bookingWindow(now, offer.timezone);
  if (date < first || date > last) return [];
  return generateSlots({
    openingHours: offer.config.openingHours,
    slotMinutes: offer.config.repair.slotMinutes,
    capacity: offer.config.repair.slotCapacity,
    date,
    timezone: offer.timezone,
    now,
    bookedCounts,
  });
}

/** The free future slots (UTC ISO starts) on `date`, within the booking window. */
export async function listSlots(
  shopId: string,
  repairPriceId: string,
  date: string,
  opts: { now?: Date } = {},
): Promise<string[]> {
  const now = opts.now ?? new Date();
  const offer = await loadOffer(shopId, repairPriceId);
  if (!offer) return [];
  // Any local day falls inside the UTC day before to the UTC day after.
  const noon = Date.parse(`${date}T12:00:00.000Z`);
  if (Number.isNaN(noon)) return [];
  const counts = await forShop(shopId).repairs.bookedCounts(new Date(noon - DAY_MS), new Date(noon + DAY_MS));
  return slotsFor(offer, date, now, counts);
}

export async function bookRepair(
  shopId: string,
  input: { repairPriceId: string; slotStart: string; customer: Customer },
  deps: { mailer?: Mailer; now?: Date } = {},
): Promise<Result<{ ticketId: string }, "slot_taken" | "slot_in_past" | "not_offered">> {
  const now = deps.now ?? new Date();
  const offer = await loadOffer(shopId, input.repairPriceId);
  if (!offer) return err("not_offered");

  const start = new Date(input.slotStart);
  // Slots are canonical ISO strings; anything else is not one we offered.
  if (Number.isNaN(start.getTime()) || start.toISOString() !== input.slotStart) return err("not_offered");
  if (start.getTime() < now.getTime()) return err("slot_in_past");

  // Offered means: inside the window, on the slot grid, inside opening hours.
  // Capacity is not checked here; the insert does it atomically.
  const date = slotDate(input.slotStart, offer.timezone);
  if (!slotsFor(offer, date, now, new Map()).includes(input.slotStart)) return err("not_offered");

  const repos = forShop(shopId);
  let ticketId: string;
  try {
    ticketId = (
      await inTransaction((tx) =>
        repos.repairs.insertTicket(tx, {
          repairPriceId: offer.price.id,
          slotStart: start,
          capacity: offer.config.repair.slotCapacity,
          source: "online",
          customerName: input.customer.name,
          customerPhone: input.customer.phone,
          customerEmail: input.customer.email,
        }),
      )
    ).id;
  } catch (error) {
    if (error instanceof SlotTakenError) return err("slot_taken");
    throw error;
  }

  // The ticket is committed; a failed email never undoes it (sendEmail never throws).
  await sendBookingEmails(shopId, offer, input.slotStart, input.customer, deps.mailer);
  return ok({ ticketId });
}

async function sendBookingEmails(
  shopId: string,
  offer: Offer,
  slotStart: string,
  customer: Customer,
  mailer?: Mailer,
): Promise<void> {
  const when = formatSlotLabel(slotStart, offer.timezone);
  const what = `${offer.price.modelName} ${offer.price.repairType}`;
  const price = formatCents(offer.price.price);

  let shopTo = offer.config.contact.email;
  if (!shopTo) shopTo = (await forShop(shopId).shop.ownerEmail()) ?? "";

  const sends: Promise<unknown>[] = [
    sendEmail(
      shopId,
      {
        to: customer.email,
        subject: `Your repair is booked: ${what}, ${when}`,
        kind: "repair_booked_customer",
        html: safeHtml`<p>Hi ${customer.name},</p><p>Your ${what} repair is booked for ${when} at ${offer.config.brand.name}.</p><p>Price: ${price}</p>`,
      },
      mailer,
    ),
  ];
  if (shopTo) {
    sends.push(
      sendEmail(
        shopId,
        {
          to: shopTo,
          subject: `New repair booking: ${what}, ${when}, ${customer.name}`,
          kind: "repair_booked_shop",
          html: safeHtml`<p>New repair booking: ${what}, ${when}.</p><p>Customer: ${customer.name}</p><p>Phone: ${customer.phone}</p><p>Email: ${customer.email}</p><p>Price: ${price}</p>`,
        },
        mailer,
      ),
    );
  }
  await Promise.all(sends);
}
