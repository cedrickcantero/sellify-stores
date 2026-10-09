import Link from "next/link";
import { notFound } from "next/navigation";
import { CONDITION_LABELS, formatCents, KIND_LABELS } from "@/domain/product";
import { getStoreProduct } from "@/services/store-products";
import { storeHref } from "@/store-ui";
import { Heading, ProductImage, StockNote, storeButtonClass } from "@/store-ui/product-views";
import { addToBasket } from "../../basket-actions";
import { requireLiveStore } from "../../store-context";

export const dynamic = "force-dynamic";

export default async function StoreProductPage({ params }: PageProps<"/s/[slug]/shop/[productId]">) {
  const { slug, productId } = await params;
  const { shopId, basePath } = await requireLiveStore(slug, "shop");
  const product = await getStoreProduct(shopId, productId);
  if (!product) notFound();

  const more = product.images.slice(1);

  return (
    <div className="flex flex-col gap-6">
      <Link href={storeHref(basePath, "/shop")} className="w-fit font-semibold underline">
        Back to the shop
      </Link>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <ProductImage product={product} className="aspect-4/3 w-full rounded-(--store-radius)" />
          {more.length > 0 ? (
            <ul className="grid grid-cols-4 gap-3">
              {more.map((src) => (
                <li key={src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${product.title}, more views`}
                    className="aspect-square w-full rounded-(--store-radius) object-cover"
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <Heading>{product.title}</Heading>
          <p className="text-3xl font-bold">{formatCents(product.price)}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="font-semibold">Type</dt>
            <dd>{KIND_LABELS[product.kind]}</dd>
            <dt className="font-semibold">Condition</dt>
            <dd>{CONDITION_LABELS[product.condition]}</dd>
            <dt className="font-semibold">Availability</dt>
            <dd>
              <StockNote product={product} />
            </dd>
          </dl>
          <form action={addToBasket.bind(null, slug, product.id)}>
            <button type="submit" disabled={product.soldOut} className={`${storeButtonClass} w-full sm:w-auto`}>
              {product.soldOut ? "Sold out" : "Add to basket"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
