import "server-only";
import { forShop, type Product } from "@/data";
import { stockStatus } from "@/domain/product";

export type StoreProduct = Product & { soldOut: boolean };

// The products a customer can see in a shop's online store: active products,
// newest first, each marked sold out when none are left. Read fresh on every
// call so a sale in the physical shop shows on the next page load.
export async function listStoreProducts(shopId: string): Promise<StoreProduct[]> {
  const products = await forShop(shopId).products.list();
  return products.map((product) => ({ ...product, soldOut: stockStatus(product.stockQty) === "sold_out" }));
}

// One active product of the shop, or null.
export async function getStoreProduct(shopId: string, productId: string): Promise<StoreProduct | null> {
  const product = await forShop(shopId).products.get(productId);
  return product ? { ...product, soldOut: stockStatus(product.stockQty) === "sold_out" } : null;
}
