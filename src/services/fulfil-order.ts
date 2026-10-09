import "server-only";
import { decrementStock, forShop, inTransaction, type SaleItem } from "@/data";
import type { Mailer } from "@/domain/email";
import { decodeOrderMetadata } from "@/domain/order-metadata";
import { formatCents } from "@/domain/product";
import { sendEmail, safeHtml } from "@/email";
import type { PaidSession } from "@/payments/gateway";
import { getStorefront } from "./store";

// The order did not come from this app, or does not add up. Retrying cannot help.
export class InvalidOrderError extends Error {
  constructor(reason: string) {
    super(`Invalid order: ${reason}`);
    this.name = "InvalidOrderError";
  }
}

// Thrown inside the stock savepoint so the lines already taken go back.
class StockRanOut extends Error {}

export type FulfilResult = { saleId: string; status: "completed" | "needs_refund" } | { duplicate: true };

// Turns a paid Checkout session into an online sale, in one transaction.
//
// The shop and lines come from the metadata this app put on the session, and
// are cross-checked: the session must be paid, its client reference must be
// the same shop, the charged total must equal the lines, and every product
// must be this shop's. Keyed by the Stripe session id: a repeat (or a
// concurrent duplicate) creates nothing and takes no stock. Products are
// locked in id order first (the same recipe as the POS), then stock is taken
// per line. If any line is short, the stock taken for the order is put back,
// the sale stays and is marked needs_refund (the customer paid; the owner
// refunds). Emails go out after the commit, and a failed email never fails
// the order.
export async function fulfilOrder(
  session: PaidSession,
  deps: { mailer?: Mailer } = {},
): Promise<FulfilResult> {
  if (!session.id) throw new InvalidOrderError("the session has no id");
  if (session.paymentStatus !== "paid") throw new InvalidOrderError("the session is not paid");
  const decoded = decodeOrderMetadata(session.metadata);
  if (!decoded.ok) throw new InvalidOrderError(decoded.error);
  const { shopId, lines } = decoded.value;
  if (session.clientReferenceId !== shopId) throw new InvalidOrderError("the shop does not match the session");
  const total = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  if (session.amountTotal !== null && session.amountTotal !== total) {
    throw new InvalidOrderError("the amount paid does not match the lines");
  }

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

    let status: "completed" | "needs_refund" = "completed";
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
  try {
    await sendOrderEmails(shopId, committed, session.customerEmail, deps.mailer);
  } catch (error) {
    console.error("Order emails failed after the sale was saved.", error);
  }
  return { saleId: committed.saleId, status: committed.status };
}

type Committed = { saleId: string; status: "completed" | "needs_refund"; items: SaleItem[]; total: number };

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
                `<ul>${lineList}</ul>` +
                safeHtml`<p>${shopName} will refund the full ${totalText} you paid. Contact the shop if you have any questions.</p>`,
            }
          : {
              to: customerEmail,
              subject: `Your order from ${shopName}`,
              kind: "order_customer",
              html:
                safeHtml`<p>Thank you for your order from ${shopName}.</p>` +
                `<ul>${lineList}</ul>` +
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
            `<ul>${lineList}</ul>` +
            safeHtml`<p>Total: ${totalText}</p><p>Customer: ${customerEmail ?? "no email given"}</p>`,
        },
        mailer,
      ),
    );
  }
  await Promise.all(sends);
}
