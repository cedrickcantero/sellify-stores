"use server";

import { redirect } from "next/navigation";
import { basketIdSchema, parseQtyInput, setLineQty } from "@/domain/cart";
import { readBuyableCart, writeCart } from "@/services/cart";
import { getStoreProduct } from "@/services/store-products";
import { storeHref } from "@/store-ui/store-href";
import { requireLiveStore } from "./store-context";

// Basket actions. Each takes the slug (bound by the page), re-resolves the
// shop on the server and reads prices and stock from the database; the
// browser sends only a product id and a quantity. New lines are always
// built from the buyable basket, so dead lines leave the cookie on the next
// write. Actions that can fail return a message for the form to show.

export type BasketState = { message?: string };

const INVALID: BasketState = { message: "Something went wrong. Reload the page and try again." };
const BAD_QTY: BasketState = { message: "Enter a quantity from 1 to 99." };

// The form passes the previous state and the form data after the bound
// arguments; adding needs neither.
export async function addToBasket(
  slug: string,
  productId: string,
  ..._formArgs: [BasketState, FormData]
): Promise<BasketState> {
  void _formArgs;
  if (!basketIdSchema.safeParse(slug).success || !basketIdSchema.safeParse(productId).success) return INVALID;
  const { shopId, basePath } = await requireLiveStore(slug, "shop");
  const product = await getStoreProduct(shopId, productId);
  if (!product) redirect(storeHref(basePath, "/shop"));
  if (product.soldOut) return { message: "Sorry, this one just sold out." };

  const lines = await readBuyableCart(shopId);
  const current = lines.find((line) => line.productId === productId)?.qty ?? 0;
  if (current >= product.stockQty) return { message: "That is all we have in stock. It is already in your basket." };

  const next = setLineQty(lines, productId, current + 1, product.stockQty);
  if (next.length === lines.length && current === 0) {
    return { message: "Your basket is full. Remove an item to add another." };
  }
  await writeCart(shopId, next);
  redirect(storeHref(basePath, "/basket"));
}

export async function setBasketQty(
  slug: string,
  productId: string,
  _previous: BasketState,
  formData: FormData,
): Promise<BasketState> {
  if (!basketIdSchema.safeParse(slug).success || !basketIdSchema.safeParse(productId).success) return INVALID;
  const qty = parseQtyInput(formData.get("qty"));
  if (qty === null) return BAD_QTY;

  const { shopId } = await requireLiveStore(slug, "shop");
  const product = await getStoreProduct(shopId, productId);
  const lines = await readBuyableCart(shopId);
  await writeCart(shopId, setLineQty(lines, productId, qty, product?.stockQty ?? 0));
  if (!product) return { message: "That item is no longer available, so we removed it." };
  if (qty > product.stockQty) {
    return { message: `Only ${product.stockQty} in stock, so we set the quantity to ${product.stockQty}.` };
  }
  return {};
}

export async function removeFromBasket(slug: string, productId: string): Promise<void> {
  if (!basketIdSchema.safeParse(slug).success || !basketIdSchema.safeParse(productId).success) return;
  const { shopId } = await requireLiveStore(slug, "shop");
  const lines = await readBuyableCart(shopId);
  await writeCart(
    shopId,
    lines.filter((line) => line.productId !== productId),
  );
}
