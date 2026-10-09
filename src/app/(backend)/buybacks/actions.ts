"use server";

import { revalidatePath } from "next/cache";
import { getActiveShop } from "@/auth/session";
import { deviceCatalog, forShop } from "@/data";
import {
  parseBasePriceForm,
  parseDeductionsForm,
  parseQuoteId,
} from "@/domain/buyback-forms";
import { BUYBACK_QUESTIONS } from "@/domain/buyback-questions";

// What a form action returns. The forms keep what the owner typed in
// controlled state, because React clears uncontrolled fields after an action.
export type FormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

function textFields(formData: FormData, names: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    fields[name] = typeof value === "string" ? value : "";
  }
  return fields;
}

export async function saveBasePrice(_previous: FormState, formData: FormData): Promise<FormState> {
  const { shopId } = await getActiveShop();
  const values = textFields(formData, ["deviceModelId", "storage", "basePrice"]);

  const parsed = parseBasePriceForm(values);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };

  const model = (await deviceCatalog.list()).find((m) => m.id === parsed.value.deviceModelId);
  if (!model || !model.storageOptions.includes(parsed.value.storage)) {
    return { status: "error", message: "Choose a model and storage size from the list." };
  }

  await forShop(shopId).buybacks.upsertBasePrice(parsed.value);
  revalidatePath("/buybacks");
  return { status: "saved", message: "Price saved." };
}

export async function removeBasePrice(formData: FormData): Promise<void> {
  const { shopId } = await getActiveShop();
  const { deviceModelId, storage } = textFields(formData, ["deviceModelId", "storage"]);
  if (deviceModelId && storage) {
    await forShop(shopId).buybacks.removeBasePrice(deviceModelId, storage);
  }
  revalidatePath("/buybacks");
}

export async function saveDeductions(_previous: FormState, formData: FormData): Promise<FormState> {
  const { shopId } = await getActiveShop();
  const names = BUYBACK_QUESTIONS.flatMap((q) =>
    ["yes", "no"].flatMap((answer) => [`${q.key}-${answer}-kind`, `${q.key}-${answer}-value`]),
  );
  const values = textFields(formData, names);

  const parsed = parseDeductionsForm(values);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };

  await forShop(shopId).buybacks.replaceDeductions(parsed.value);
  revalidatePath("/buybacks");
  return { status: "saved", message: "Deductions saved." };
}

export type ReceivedState = { message?: string };

export async function markQuoteReceived(
  _previous: ReceivedState,
  formData: FormData,
): Promise<ReceivedState> {
  const { shopId } = await getActiveShop();
  const quoteId = parseQuoteId(formData.get("quoteId"));
  if (!quoteId) return { message: "This quote was already updated." };

  const updated = await forShop(shopId).buybacks.markReceived(quoteId);
  revalidatePath("/buybacks");
  return updated ? {} : { message: "This quote was already updated." };
}
