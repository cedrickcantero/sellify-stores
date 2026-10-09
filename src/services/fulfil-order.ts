import "server-only";
import { decrementStock, forShop, inTransaction, type SaleItem, type SaleStatus } from "@/data";
import type { Mailer } from "@/domain/email";
import { decodeOrderMetadata, ORDER_APP, type OrderLine } from "@/domain/order-metadata";
import { formatCents } from "@/domain/product";
import { sendEmail, safeHtml } from "@/email";
import type { PaidSession } from "@/payments/gateway";
import { getStorefront } from "./store";

// The order did not come from this app, or does not add up. Retrying cannot help.
export class InvalidOrderError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid order: ${reason}`);
    this.name = "InvalidOrderError";
  }
}

// Thrown inside the stock savepoint so the lines already taken go back.
class StockRanOut extends Error {}

export type FulfilResult =
  | { saleId: string; status: SaleStatus }
  | { duplicate: true }
  // A paid order that could not be attributed to any shop: logged, not recorded.
  | { unrecorded: true };

// Turns a paid Checkout session into an online sale, in one transaction.
//
// The shop and lines come from the metadata this app put on the session, and
// are cross-checked: the client reference must be the same shop, the charged
// total must equal the lines, and every product must be this shop's. Keyed by
// the Stripe session id: a repeat (or a concurrent duplicate) creates nothing
// and takes no stock. Products are locked in id order first (the same recipe
// as the POS), then stock is taken per line. If any line is short, the stock
// taken for the order is put back, the sale stays and is marked needs_refund
// (the customer paid; the owner refunds). Emails go out after the commit, and
// a failed email never fails the order.
//
// A paid session that fails those checks is never dropped (Stripe would
// retry a failure and then give up, leaving no trace of the payment): it is
// recorded as a needs_refund sale for the amount paid, with no stock taken
// and only the lines that can be attributed to the shop, and the same issue
// emails go out. Only sessions this app did not create, or that are not paid,
// throw InvalidOrderError. Database errors propagate so the webhook can ask
// Stripe to retry.
export async function fulfilOrder(
  session: PaidSession,
  deps: { mailer?: Mailer } = {},
): Promise<FulfilResult> {
  if (!session.id) throw new InvalidOrderError("the session has no id");
  if (session.metadata.app !== ORDER_APP) throw new InvalidOrderError("the session was not created by this app");
  if (session.paymentStatus !== "paid") throw new InvalidOrderError("the session is not paid");

  const decoded = decodeOrderMetadata(session.metadata);
  if (!decoded.ok) return recordUnfulfillable(session, decoded.error, deps);
  const { shopId, lines } = decoded.value;
  if (session.clientReferenceId !== shopId) {
    return recordUnfulfillable(session, "the shop does not match the session", deps);
  }
  const total = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  if (session.amountTotal !== total) {
    return recordUnfulfillable(session, "the amount paid does not match the lines", deps);
  }

  try {
    return await fulfilValid(session, shopId, lines, total, deps);
  } catch (error) {
    if (error instanceof InvalidOrderError) return recordUnfulfillable(session, error.reason, deps);
    throw error;
  }
}

async function fulfilValid(
  session: PaidSession,
  shopId: string,
  lines: OrderLine[],
  total: number,
  deps: { mailer?: Mailer },
): Promise<FulfilResult> {
  const sales = forShop(shopId).sales;
  const committed = await inTransaction(async (tx) => {
    const byId = new Map(
      (
        await sales.lockProducts(
          tx,
          lines.map((l) => l.productId),
          { includeArchived: true },
        )
      ).map((p) => [p.id, p]),
    );
    const items: SaleItem[] = [];
    for (const line of lines) {
      const found = byId.get(line.productId);
      if (!found) throw new InvalidOrderError("a product is not in this shop");
      items.push({ productId: found.id, title: found.title, quantity: line.qty, unitPrice: line.unitPrice });
    }

    const created = await sales.createOnline(tx, { stripeSessionId: session.id, items });
    if ("duplicate" in created) return null;

    let status: SaleStatus = "completed";
    try {
      // A savepoint, so a short line also undoes the lines taken before it.
      await tx.transaction(async (savepoint) => {
        for (const item of [...items].sort((a, b) => (a.productId < b.productId ? -1 : 1))) {
          if (!(await decrementStock(savepoint, shopId, item.productId, item.quantity))) throw new StockRanOut();
        }
      });
    } catch (error) {
      if (!(error instanceof StockRanOut)) throw error;
      status = "needs_refund";
      await sales.markNeedsRefund(tx, created.saleId);
    }
    return { saleId: created.saleId, status, items, total };
  });

  if (!committed) return { duplicate: true };
  await emailQuietly(shopId, committed, session.customerEmail, deps.mailer);
  return { saleId: committed.saleId, status: committed.status };
}

// A paid session that failed validation: keep a record of the payment.
async function recordUnfulfillable(
  session: PaidSession,
  reason: string,
  deps: { mailer?: Mailer },
): Promise<FulfilResult> {
  const decoded = decodeOrderMetadata(session.metadata);
  const shopId = session.metadata.shopId || session.clientReferenceId || "";
  if (!shopId || !(await forShop(shopId).shop.get())) {
    // Never log customer data or keys: the session id and the reason only.
    console.error(`Paid order ${session.id} could not be recorded: ${reason} (no such shop).`);
    return { unrecorded: true };
  }
  console.error(`Paid order ${session.id} needs a refund: ${reason}.`);

  const sales = forShop(shopId).sales;
  const paid = Number.isInteger(session.amountTotal) && (session.amountTotal ?? 0) >= 0 ? session.amountTotal! : 0;
  const committed = await inTransaction(async (tx) => {
    const items: SaleItem[] = [];
    if (decoded.ok) {
      const byId = new Map(
        (
          await sales.lockProducts(
            tx,
            decoded.value.lines.map((l) => l.productId),
            { includeArchived: true },
          )
        ).map((p) => [p.id, p]),
      );
      for (const line of decoded.value.lines) {
        const found = byId.get(line.productId);
        if (found) items.push({ productId: found.id, title: found.title, quantity: line.qty, unitPrice: line.unitPrice });
      }
    }
    const created = await sales.createUnfulfilled(tx, { stripeSessionId: session.id, total: paid, items });
    if ("duplicate" in created) return null;
    return { saleId: created.saleId, status: "needs_refund" as const, items, total: paid };
  });
  if (!committed) return { duplicate: true };
  await emailQuietly(shopId, committed, session.customerEmail, deps.mailer);
  return { saleId: committed.saleId, status: committed.status };
}

async function emailQuietly(
  shopId: string,
  order: Committed,
  customerEmail: string | null,
  mailer?: Mailer,
): Promise<void> {
  try {
    await sendOrderEmails(shopId, order, customerEmail, mailer);
  } catch (error) {
    console.error("Order emails failed after the sale was saved.", error);
  }
}

type Committed = { saleId: string; status: SaleStatus; items: SaleItem[]; total: number };

async function sendOrderEmails(
  shopId: string,
  order: Committed,
  customerEmail: string | null,
  mailer?: Mailer,
): Promise<void> {
  const repos = forShop(shopId);
  const [shop, ownerEmail, storefront] = await Promise.all([
    repos.shop.get(),
    repos.shop.ownerEmail(),
    getStorefront(shopId, { preview: false }),
  ]);
  const shopName = shop?.name ?? "the shop";
  const shopTo = (storefront.status === "live" ? storefront.config.contact.email : "") || ownerEmail || "";
  const summary = order.items.map((i) => `${i.quantity} x ${i.title} (${formatCents(i.unitPrice * i.quantity)})`);
  const lineList = summary.map((line) => safeHtml`<li>${line}</li>`).join("");
  const list = lineList ? `<ul>${lineList}</ul>` : "";
  const totalText = formatCents(order.total);
  const refund = order.status === "needs_refund";

  const sends: Promise<unknown>[] = [];
  if (customerEmail) {
    sends.push(
      sendEmail(
        shopId,
        refund
          ? {
              to: customerEmail,
              subject: `There is a problem with your order from ${shopName}`,
              kind: "order_issue_customer",
              html:
                safeHtml`<p>Thank you for your order. Sorry, an item sold out while you were paying, so we could not complete it.</p>` +
                list +
                safeHtml`<p>${shopName} will refund the full ${totalText} you paid. Contact the shop if you have any questions.</p>`,
            }
          : {
              to: customerEmail,
              subject: `Your order from ${shopName}`,
              kind: "order_customer",
              html:
                safeHtml`<p>Thank you for your order from ${shopName}.</p>` +
                list +
                safeHtml`<p>Total paid: ${totalText}</p>`,
            },
        mailer,
      ),
    );
  }
  if (shopTo) {
    sends.push(
      sendEmail(
        shopId,
        {
          to: shopTo,
          subject: refund ? `Online order needs a refund: ${totalText}` : `New online order: ${totalText}`,
          kind: "order_shop",
          html:
            safeHtml`<p>${refund ? "An online order was paid but an item ran out of stock, so it needs a refund." : "You have a new online order."}</p>` +
            list +
            safeHtml`<p>Total: ${totalText}</p><p>Customer: ${customerEmail ?? "no email given"}</p>`,
        },
        mailer,
      ),
    );
  }
  await Promise.all(sends);
}
