import Link from "next/link";
import { cartTotals } from "@/domain/cart";
import { formatCents } from "@/domain/product";
import { loadBasket } from "@/services/cart";
import { storeHref } from "@/store-ui/store-href";
import { QuantityForm } from "@/store-ui/basket-forms";
import { Heading, ProductImage, storeButtonClass, storeSecondaryButtonClass } from "@/store-ui/product-views";
import { removeFromBasket, setBasketQty } from "../basket-actions";
import { requireLiveStore } from "../store-context";

export const dynamic = "force-dynamic";

export default async function StoreBasketPage({ params }: PageProps<"/s/[slug]/basket">) {
  const { slug } = await params;
  const { shopId, basePath, preview } = await requireLiveStore(slug, "shop");
  // What can be bought right now: quantities capped at current stock, prices
  // from the database.
  const { saved, lines, products } = await loadBasket(shopId);
  const { lines: priced, total } = cartTotals(lines, products);
  const adjusted = saved.length !== lines.length || saved.some((line, i) => line.qty !== lines[i]?.qty);

  return (
    <div className="flex flex-col gap-6">
      <Heading>Your basket</Heading>
      {adjusted ? (
        <p role="status" className="rounded-(--store-radius) border border-(--store-text)/40 p-3">
          Some items changed because stock changed. Check your basket before you continue.
        </p>
      ) : null}
      {priced.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p>Your basket is empty.</p>
          <Link href={storeHref(basePath, "/shop", preview)} className={storeSecondaryButtonClass}>
            Browse the shop
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-(--store-text)/15 border-y border-(--store-text)/15">
            {priced.map(({ product, qty, lineTotal }) => (
              <li key={product.id} className="grid grid-cols-[5rem_1fr] gap-4 py-4 sm:grid-cols-[6rem_1fr_auto]">
                <ProductImage product={product} className="aspect-square w-full rounded-(--store-radius)" />
                <div className="flex flex-col gap-2">
                  <Link href={storeHref(basePath, `/shop/${product.id}`, preview)} className="font-bold underline">
                    {product.title}
                  </Link>
                  <p>{formatCents(product.price)} each</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <QuantityForm action={setBasketQty.bind(null, slug, product.id)} qty={qty} max={product.stockQty} />
                    <form action={removeFromBasket.bind(null, slug, product.id)}>
                      <button
                        type="submit"
                        aria-label={`Remove ${product.title}`}
                        className={storeSecondaryButtonClass}
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                  {qty === product.stockQty ? <p role="status" className="text-sm">That is all we have in stock.</p> : null}
                </div>
                <p className="col-span-2 text-lg font-bold sm:col-span-1 sm:text-right">{formatCents(lineTotal)}</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-end gap-4">
            <p className="text-xl">
              Total <strong className="ml-2 text-2xl">{formatCents(total)}</strong>
            </p>
            {/* Placeholder: checkout arrives with the checkout ticket. */}
            <button type="button" disabled className={`${storeButtonClass} w-full sm:w-auto`}>
              Checkout (coming soon)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
