"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveShop } from "@/auth/session";
import {
  DeviceModelNotFoundError,
  forShop,
  RepairTypeNotFoundError,
  SlotTakenError,
} from "@/data";

export type ActionResult = { error?: string };

const typeInput = z.object({
  name: z.string().trim().min(1, "Enter a repair type name.").max(60, "Use 60 characters or fewer."),
});

export async function createRepairTypeAction(input: { name: string }): Promise<ActionResult> {
  const { shopId } = await getActiveShop();
  const parsed = typeInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await forShop(shopId).repairs.createType(parsed.data.name);
  revalidatePath("/repairs");
  return {};
}

const priceInput = z.object({
  deviceModelId: z.string().min(1, "Choose a model."),
  repairTypeId: z.string().min(1, "Choose a repair type."),
  // Euros typed by the owner, stored as integer cents.
  price: z
    .string()
    .trim()
    .regex(/^\d{1,6}([.,]\d{1,2})?$/, "Enter a price above 0.")
    .transform((value) => Math.round(Number(value.replace(",", ".")) * 100))
    .refine((cents) => cents > 0, "Enter a price above 0."),
  partQty: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, "Enter a part quantity of 0 or more.")
    .transform(Number),
});

export async function saveRepairPriceAction(input: {
  deviceModelId: string;
  repairTypeId: string;
  price: string;
  partQty: string;
}): Promise<ActionResult> {
  const { shopId } = await getActiveShop();
  const parsed = priceInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await forShop(shopId).repairs.upsertPrice(parsed.data);
  } catch (error) {
    if (error instanceof RepairTypeNotFoundError) {
      return { error: "Choose one of your repair types." };
    }
    if (error instanceof DeviceModelNotFoundError) {
      return { error: "Choose a device from the list." };
    }
    throw error;
  }
  revalidatePath("/repairs");
  return {};
}

const statusInput = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["booked", "in_progress", "done", "cancelled"]),
});

export async function setTicketStatusAction(input: {
  ticketId: string;
  status: string;
}): Promise<ActionResult> {
  const { shopId } = await getActiveShop();
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return { error: "Choose a status." };
  try {
    const found = await forShop(shopId).repairs.setTicketStatus(
      parsed.data.ticketId,
      parsed.data.status,
    );
    if (!found) return { error: "That ticket no longer exists." };
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return { error: "That place was booked again. Leave this ticket cancelled." };
    }
    throw error;
  }
  revalidatePath("/repairs");
  return {};
}
