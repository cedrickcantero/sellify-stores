import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@/domain/product";
import { clientIp } from "@/domain/abuse";
import { getOrderStatus } from "@/services/order-status";
import { ClearBasket, OrderRefresh } from "@/store-ui/checkout-forms";
import { Heading, storeSecondaryButtonClass } from "@/store-ui/product-views";
import { storeHref } from "@/store-ui/store-href";
import { clearBasket } from "../../basket-actions";
import { loadStore } from "../../store-context";

// Never cached: what it says depends on whether the webhook has run yet.
export const dynamic = "force-dynamic";

// The page Stripe sends the customer back to. The redirect alone proves
// nothing, so this shows an order only when the sale is recorded (or Stripe
// confirms the payment and we wait for the webhook).
export default async function CheckoutSuccessPage({ params, searchParams }: PageProps<"/s/[slug]/checkout/success">) {
  const { slug } = await params;
  const { session_id: sessionParam } = await searchParams;
  // Not requireLiveStore: a customer who has paid still sees the outcome if
  // the store was switched offline or its shop tab turned off since.
  const store = await loadStore(slug);
  if (!store) notFound();
  const { shopId, basePath, preview } = store;
  const sessionId = typeof sessionParam === "string" ? sessionParam : undefined;

  let status;
  try {
    status = await getOrderStatus(shopId, sessionId, { ip: clientIp(await headers()) });
  } catch (error) {
    console.error("Could not check the order with the payment provider.", error);
    return (
      <div className="flex flex-col items-start gap-4">
        <Heading>We could not check your order</Heading>
        <p>If you paid, you will get a confirmation email shortly. Otherwise try again in a moment.</p>
        <Link href={storeHref(basePath, "/shop", preview)} className={storeSecondaryButtonClass}>
          Back to the shop
        </Link>
      </div>
    );
  }

  if (status.state === "unknown") {
    return (
      <div className="flex flex-col items-start gap-4">
        <Heading>We could not find this order</Heading>
        <p>Your basket has not changed. If you were charged, contact the shop.</p>
        <Link href={storeHref(basePath, "/basket", preview)} className={storeSecondaryButtonClass}>
          Back to your basket
        </Link>
      </div>
    );
  }

  if (status.state === "pending") {
    return (
      <div className="flex flex-col items-start gap-4">
        <OrderRefresh />
        <Heading>Payment received, confirming your order</Heading>
        <p role="status">This usually takes a few seconds. This page updates by itself.</p>
        <p>If it takes longer than a minute, you will still get a confirmation email.</p>
      </div>
    );
  }

  const { sale } = status;
  const refund = sale.status === "needs_refund";
  return (
    <div className="flex flex-col gap-6">
      <ClearBasket action={clearBasket.bind(null, slug, sessionId ?? "")} />
      {refund ? (
        <>
          <Heading>There is a problem with your order</Heading>
          <p role="status" className="rounded-(--store-radius) border border-(--store-text)/40 p-3">
            Sorry, something sold out while you were paying, so we could not complete your order. The shop will refund
            the full amount. We have emailed you the details.
          </p>
        </>
      ) : (
        <>
          <Heading>Thank you, your order is confirmed</Heading>
          <p role="status">We have emailed you a confirmation.</p>
        </>
      )}
      <ul className="flex flex-col divide-y divide-(--store-text)/15 border-y border-(--store-text)/15">
        {sale.items.map((item) => (
          <li key={item.productId} className="flex justify-between gap-4 py-3">
            <span>
              {item.quantity} x {item.title}
            </span>
            <span>{formatCents(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xl">
        {refund ? "Paid" : "Total"} <strong className="ml-2 text-2xl">{formatCents(sale.total)}</strong>
      </p>
      <Link href={storeHref(basePath, "/shop", preview)} className={`${storeSecondaryButtonClass} self-start`}>
        Keep shopping
      </Link>
    </div>
  );
}
