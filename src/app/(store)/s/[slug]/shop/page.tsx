import { listStoreProducts } from "@/services/store-products";
import { Heading, ProductGrid } from "@/store-ui/product-views";
import { addToBasket } from "../basket-actions";
import { requireLiveStore } from "../store-context";

// Read on every request, never cached, so stock is always current.
export const dynamic = "force-dynamic";

export default async function StoreShopPage({ params }: PageProps<"/s/[slug]/shop">) {
  const { slug } = await params;
  const { shopId, basePath, preview } = await requireLiveStore(slug, "shop");
  const products = await listStoreProducts(shopId);

  return (
    <div className="flex flex-col gap-6">
      <Heading>Shop</Heading>
      {products.length === 0 ? (
        <p>There is nothing in stock online right now. Check back soon.</p>
      ) : (
        <ProductGrid
          products={products}
          basePath={basePath}
          preview={preview}
          addAction={(productId) => addToBasket.bind(null, slug, productId)}
        />
      )}
    </div>
  );
}
