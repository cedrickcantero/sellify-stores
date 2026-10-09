"use server";

import { redirect } from "next/navigation";
import { setLineQty } from "@/domain/cart";
import { readCart, writeCart } from "@/services/cart";
import { getStoreProduct } from "@/services/store-products";
import { storeHref } from "@/store-ui";
import { requireLiveStore } from "./store-context";

// Basket actions. Each takes the slug (bound by the page), re-resolves the
// shop on the server and reads prices and stock from the database; the
// browser sends only a product id and a quantity.

async function resolveShop(slug: string) {
  const { shopId, basePath } = await requireLiveStore(slug, "shop");
  return { shopId, basePath };
}

export async function addToBasket(slug: string, productId: string): Promise<void> {
  const { shopId, basePath } = await resolveShop(slug);
  const product = await getStoreProduct(shopId, productId);
  if (!product) redirect(storeHref(basePath, "/shop"));

  const lines = await readCart(shopId);
  const current = lines.find((line) => line.productId === productId)?.qty ?? 0;
  await writeCart(shopId, setLineQty(lines, productId, current + 1, product.stockQty));
  redirect(storeHref(basePath, "/basket"));
}

export async function setBasketQty(slug: string, productId: string, formData: FormData): Promise<void> {
  const { shopId } = await resolveShop(slug);
  const product = await getStoreProduct(shopId, productId);
  const qty = Number(formData.get("qty"));
  const lines = await readCart(shopId);
  await writeCart(shopId, setLineQty(lines, productId, qty, product?.stockQty ?? 0));
}

export async function removeFromBasket(slug: string, productId: string): Promise<void> {
  const { shopId } = await resolveShop(slug);
  const lines = await readCart(shopId);
  await writeCart(
    shopId,
    lines.filter((line) => line.productId !== productId),
  );
}
