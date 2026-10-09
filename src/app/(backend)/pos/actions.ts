"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveShop } from "@/auth/session";
import { recordPosSale } from "@/services/record-pos-sale";

export type PosSaleState = {
  saleId?: string;
  /** Sale total in cents, read back from the saved sale. */
  total?: number;
  /** Ids of the products that were short; the sale was not recorded. */
  outOfStock?: string[];
  error?: string;
};

const lines = z
  .array(z.object({ productId: z.string().min(1).max(100), qty: z.number() }))
  .max(200);

// The browser sends only product ids and quantities. Prices come from the
// database inside recordPosSale, and the shop id from the session.
export async function completePosSaleAction(input: unknown): Promise<PosSaleState> {
  const parsed = lines.safeParse(input);
  if (!parsed.success) return { error: "Check the quantities and try again." };
  const { shopId } = await getActiveShop();
  const result = await recordPosSale(shopId, parsed.data);
  if (!result.ok) {
    revalidatePath("/pos");
    if (result.error.invalid) return { error: result.error.invalid };
    return { outOfStock: result.error.outOfStock };
  }
  revalidatePath("/pos");
  revalidatePath("/sales");
  return { saleId: result.value.saleId };
}
