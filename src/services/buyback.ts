import "server-only";
import { deviceCatalog, forShop, type BuybackQuote } from "@/data";
import { answersSummary, formatEuros } from "@/domain/buyback-questions";
import { quoteBuyback } from "@/domain/buyback-quote";
import { parseBuybackCustomer, parseQuoteInput } from "@/domain/buyback-forms";
import type { Mailer } from "@/domain/email";
import { err, ok, type Result } from "@/domain/result";
import { StoreConfig } from "@/domain/store-config";
import { safeHtml, sendEmail } from "@/email";

// Buyback use cases for the store's Sell tab. The shop id always comes from
// the server (the resolved store), never from the browser, and the offer is
// always calculated here from the shop's own buyback prices.

const QUOTE_VALID_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type Deps = { now?: Date; mailer?: Mailer };

// Calculates the offer for a phone and stores the quote. A model and storage
// the shop does not buy is not_offered; malformed input is invalid.
export async function createQuote(
  shopId: string,
  input: { deviceModelId: string; storage: string; answers: Record<string, boolean> },
  deps: Pick<Deps, "now"> = {},
): Promise<Result<{ quoteId: string; offer: number; expiresAt: Date }, "not_offered" | "invalid">> {
  const parsed = parseQuoteInput(input);
  if (!parsed.ok) return err("invalid");
  const { deviceModelId, storage, answers } = parsed.value;

  const buybacks = forShop(shopId).buybacks;
  const [basePrice, deductions] = await Promise.all([
    buybacks.getBasePrice(deviceModelId, storage),
    buybacks.listDeductions(),
  ]);
  if (basePrice === null) return err("not_offered");

  const now = deps.now ?? new Date();
  const quote = await buybacks.insertQuote({
    deviceModelId,
    storage,
    answers,
    offer: quoteBuyback(basePrice, deductions, answers),
    expiresAt: new Date(now.getTime() + QUOTE_VALID_DAYS * DAY_MS),
  });
  return ok({ quoteId: quote.id, offer: quote.offer, expiresAt: quote.expiresAt });
}

// Accepts a quote for a drop-in handover and emails both sides. The quote
// must belong to this shop, be unexpired and still be quoted; the accept is
// one atomic update, so of two simultaneous accepts only one wins. An email
// that cannot be sent never fails the submission (it is in the outbox).
export async function submitBuyback(
  shopId: string,
  quoteId: string,
  customer: { name: string; phone: string; email: string },
  deps: Deps = {},
): Promise<Result<{ quoteId: string }, "not_found" | "expired" | "already_accepted" | "cancelled">> {
  const parsed = parseBuybackCustomer(customer);
  if (!parsed.ok) throw new Error("submitBuyback needs a validated customer.");

  const buybacks = forShop(shopId).buybacks;
  const quote = await buybacks.getQuote(quoteId);
  if (!quote) return err("not_found");

  const now = deps.now ?? new Date();
  if (quote.status === "cancelled") return err("cancelled");
  if (quote.status !== "quoted") return err("already_accepted");
  if (quote.expiresAt <= now) return err("expired");

  if (!(await buybacks.acceptQuote(quoteId, parsed.value, now))) return err("already_accepted");

  await sendAcceptedEmails(shopId, quote, parsed.value, deps.mailer);
  return ok({ quoteId });
}

async function sendAcceptedEmails(
  shopId: string,
  quote: BuybackQuote,
  customer: { name: string; phone: string; email: string },
  mailer?: Mailer,
): Promise<void> {
  try {
    const repos = forShop(shopId);
    const [shop, row, ownerEmail, models] = await Promise.all([
      repos.shop.get(),
      repos.storeConfig.get(),
      repos.shop.ownerEmail(),
      deviceCatalog.list(),
    ]);
    const published = row?.published ? StoreConfig.safeParse(row.published) : null;
    const config = published?.success ? published.data : null;
    const shopName = config?.brand.name || shop?.name || "the shop";
    const shopEmail = config?.contact.email || ownerEmail;

    const model = models.find((m) => m.id === quote.deviceModelId);
    const device = `${model ? `${model.brand} ${model.name}` : "Phone"} ${quote.storage}`;
    const offer = formatEuros(quote.offer);
    const condition = answersSummary(quote.answers);

    const sends: Promise<unknown>[] = [];
    if (shopEmail) {
      sends.push(
        sendEmail(
          shopId,
          {
            to: shopEmail,
            kind: "buyback_accepted_shop",
            subject: `Buyback accepted: ${device}, ${offer}`,
            html: safeHtml`<p>${customer.name} accepted an offer of ${offer} for a ${device}.</p>
<p>Condition: ${condition}.</p>
<p>Phone: ${customer.phone}<br>Email: ${customer.email}</p>
<p>They will drop in to the shop. Mark the buyback as received in Sellify when they arrive.</p>`,
          },
          mailer,
        ),
      );
    }
    sends.push(
      sendEmail(
        shopId,
        {
          to: customer.email,
          kind: "buyback_accepted_customer",
          subject: `Your offer from ${shopName}: ${offer}`,
          html: safeHtml`<p>Hi ${customer.name},</p>
<p>${shopName} will pay you ${offer} for your ${device} (${condition}).</p>
<p>Drop in to the shop with your phone and we will pay you on the spot.</p>
<p>${config?.contact.address ?? ""}<br>${config?.contact.phone ?? ""}</p>`,
        },
        mailer,
      ),
    );
    await Promise.all(sends);
  } catch (error) {
    // The quote is already accepted; a failure here must not undo that.
    console.error("Buyback emails not sent.", error);
  }
}
