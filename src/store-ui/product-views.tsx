import Link from "next/link";
import type { ReactNode } from "react";
import { CONDITION_LABELS, formatCents, type ProductCondition } from "@/domain/product";

export type ProductView = {
  id: string;
  title: string;
  condition: ProductCondition;
  price: number;
  stockQty: number;
  images: string[];
  soldOut: boolean;
};

const LOW_STOCK = 3;

export function ProductImage({ product, className }: { product: ProductView; className: string }) {
  const src = product.images[0];
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`No photo for ${product.title}`}
        className={`${className} flex items-center justify-center bg-(--store-text)/10 text-sm text-(--store-text)/75`}
      >
        No photo
      </div>
    );
  }
  // Plain <img>: the Blob host is not configured for next/image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={product.title} className={`${className} object-cover`} loading="lazy" />;
}

export function StockNote({ product }: { product: ProductView }) {
  if (product.soldOut) return <span className="font-semibold">Sold out</span>;
  if (product.stockQty <= LOW_STOCK) return <span>Only {product.stockQty} left</span>;
  return <span>In stock</span>;
}

export const storeButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-(--store-radius) bg-(--store-primary) px-5 font-semibold text-(--store-on-primary) hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary) disabled:cursor-not-allowed disabled:opacity-50";

export const storeSecondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-(--store-radius) border border-(--store-text)/40 px-4 font-semibold hover:bg-(--store-text)/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary)";

export function ProductGrid({
  products,
  basePath,
  addAction,
}: {
  products: ProductView[];
  basePath: string;
  /** Returns the form action that adds this product to the basket. */
  addAction: (productId: string) => () => Promise<void>;
}) {
  return (
    <ul className="grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li
          key={product.id}
          className="flex flex-col overflow-hidden rounded-(--store-radius) border border-(--store-text)/15"
        >
          <Link
            href={`${basePath}/shop/${product.id}`}
            className="flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary)"
          >
            <ProductImage product={product} className="aspect-4/3 w-full" />
            <span className="px-4 pt-4 font-(family-name:--store-font-heading) text-lg font-bold">
              {product.title}
            </span>
          </Link>
          <div className="flex flex-1 flex-col gap-3 px-4 pt-1 pb-4">
            <p className="text-sm">{CONDITION_LABELS[product.condition]}</p>
            <p className="text-xl font-bold">{formatCents(product.price)}</p>
            <p className="text-sm">
              <StockNote product={product} />
            </p>
            <form action={addAction(product.id)} className="mt-auto">
              <button type="submit" disabled={product.soldOut} className={`${storeButtonClass} w-full`}>
                {product.soldOut ? "Sold out" : "Add to basket"}
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <h1 className="font-(family-name:--store-font-heading) text-3xl font-bold">{children}</h1>;
}
