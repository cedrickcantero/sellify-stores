"use server";

import { revalidatePath } from "next/cache";
import { getActiveShop } from "@/auth/session";
import { forShop } from "@/data";
import type { ProductFieldErrors } from "@/domain/product";
import { saveProduct } from "@/services/save-product";

// `values` echoes the typed fields back so the form keeps them after an error.
export type ProductFormState = {
  saved?: boolean;
  fields?: ProductFieldErrors;
  form?: string;
  values?: Record<string, string>;
  keptImages?: string[];
};

const FIELDS = ["title", "kind", "condition", "price", "stockQty", "deviceModelId"] as const;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function strings(form: FormData, name: string): string[] {
  return form.getAll(name).filter((v): v is string => typeof v === "string");
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
  const keptImages = strings(form, "keptImage");

  const result = await saveProduct(shopId, {
    id: text(form, "id") || undefined,
    values,
    keptImages,
    files: form.getAll("photos").filter((v): v is File => v instanceof File),
  });
  if (!result.ok) return { ...result.error, values, keptImages };

  revalidatePath("/inventory");
  return { saved: true };
}

export async function removeProductAction(id: string): Promise<{ error?: string }> {
  const { shopId } = await getActiveShop();
  const removed = await forShop(shopId).products.remove(id);
  revalidatePath("/inventory");
  return removed ? {} : { error: "That product was already removed." };
}
