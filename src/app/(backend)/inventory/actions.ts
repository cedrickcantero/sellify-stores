"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveShop } from "@/auth/session";
import { forShop } from "@/data";
import type { ProductFieldErrors } from "@/domain/product";
import { saveProduct } from "@/services/save-product";

// `values` echoes the typed fields back so the form keeps them after an error.
export type ProductFormState = {
  saved?: boolean;
  /** The edit was refused because stock moved; the list is refreshed, the form should close. */
  stockChanged?: boolean;
  fields?: ProductFieldErrors;
  form?: string;
  values?: Record<string, string>;
};

const FIELDS = ["title", "kind", "condition", "price", "stockQty", "deviceModelId"] as const;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveProductAction(
  _prev: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  const { shopId } = await getActiveShop();
  const values = Object.fromEntries(FIELDS.map((name) => [name, text(form, name)])) as Record<
    (typeof FIELDS)[number],
    string
  >;
  // The device model Select cannot hold an empty value, so "none" stands for it.
  if (values.deviceModelId === "none") values.deviceModelId = "";

  const expected = text(form, "expectedStockQty");
  const result = await saveProduct(shopId, {
    id: text(form, "id") || undefined,
    values,
    imageUrls: form.getAll("image").filter((v): v is string => typeof v === "string"),
    expectedStockQty: /^\d{1,9}$/.test(expected) ? Number(expected) : undefined,
  });
  if (!result.ok) {
    if (result.error.stockChanged) revalidatePath("/inventory");
    return { ...result.error, values };
  }

  revalidatePath("/inventory");
  return { saved: true };
}

const productId = z.uuid();

export async function removeProductAction(id: string): Promise<{ error?: string }> {
  const parsed = productId.safeParse(id);
  if (!parsed.success) {
    return { error: "We could not find that product. Reload the page and try again." };
  }
  const { shopId } = await getActiveShop();
  const removed = await forShop(shopId).products.remove(parsed.data);
  revalidatePath("/inventory");
  return removed ? {} : { error: "That product was already removed." };
}
