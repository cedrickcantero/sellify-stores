"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveShop } from "@/auth/session";
import { deviceCatalog, forShop } from "@/data";
import { BUYBACK_QUESTIONS, parseEuros } from "@/domain/buyback-questions";

export type FormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const priceSchema = z.object({
  deviceModelId: z.string().min(1, "Choose a model."),
  storage: z.string().min(1, "Choose a storage size."),
  basePrice: z.string(),
});

export async function saveBasePrice(_previous: FormState, formData: FormData): Promise<FormState> {
  const { shopId } = await getActiveShop();
  const parsed = priceSchema.safeParse({
    deviceModelId: formData.get("deviceModelId") ?? "",
    storage: formData.get("storage") ?? "",
    basePrice: formData.get("basePrice") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { status: "error", fieldErrors };
  }

  const cents = parseEuros(parsed.data.basePrice);
  if (cents === null || cents <= 0) {
    return { status: "error", fieldErrors: { basePrice: "Enter a price above 0." } };
  }

  const model = (await deviceCatalog.list()).find((m) => m.id === parsed.data.deviceModelId);
  if (!model || !model.storageOptions.includes(parsed.data.storage)) {
    return { status: "error", message: "Choose a model and storage size from the list." };
  }

  await forShop(shopId).buybacks.upsertBasePrice({
    deviceModelId: model.id,
    storage: parsed.data.storage,
    basePrice: cents,
  });
  revalidatePath("/buybacks");
  return { status: "saved", message: "Price saved." };
}

export async function saveDeductions(_previous: FormState, formData: FormData): Promise<FormState> {
  const { shopId } = await getActiveShop();
  const buybacks = forShop(shopId).buybacks;

  const rules: { key: (typeof BUYBACK_QUESTIONS)[number]["key"]; answer: boolean; kind: "amount" | "floor" | "none"; cents: number }[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const question of BUYBACK_QUESTIONS) {
    for (const answer of [true, false]) {
      const name = `${question.key}-${answer ? "yes" : "no"}`;
      const kind = String(formData.get(`${name}-kind`) ?? "none");
      if (kind !== "none" && kind !== "amount" && kind !== "floor") {
        fieldErrors[name] = "Choose none, deduct or fixed offer.";
        continue;
      }
      if (kind === "none") {
        rules.push({ key: question.key, answer, kind, cents: 0 });
        continue;
      }
      const cents = parseEuros(String(formData.get(`${name}-value`) ?? ""));
      if (cents === null) {
        fieldErrors[name] = "Enter an amount, for example 25 or 12.50.";
        continue;
      }
      rules.push({ key: question.key, answer, kind, cents });
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { status: "error", fieldErrors };

  for (const rule of rules) {
    if (rule.kind === "none") {
      await buybacks.removeDeduction(rule.key, rule.answer);
    } else {
      await buybacks.setDeduction({
        questionKey: rule.key,
        answer: rule.answer,
        kind: rule.kind,
        value: rule.cents,
      });
    }
  }
  revalidatePath("/buybacks");
  return { status: "saved", message: "Deductions saved." };
}

export async function markQuoteReceived(formData: FormData): Promise<void> {
  const { shopId } = await getActiveShop();
  const quoteId = String(formData.get("quoteId") ?? "");
  if (quoteId) await forShop(shopId).buybacks.markReceived(quoteId);
  revalidatePath("/buybacks");
}
