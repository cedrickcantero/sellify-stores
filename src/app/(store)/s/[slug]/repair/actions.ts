"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { BookingCustomer } from "@/domain/repair-booking";
import { clientIp, isHoneypotTripped, rateLimit } from "@/services/abuse";
import { bookRepair, listSlots } from "@/services/repair-booking";
import { requireLiveStore } from "../store-context";

// The shop always comes from the store address (requireLiveStore), never
// from the form. The browser names only a repair price and a slot.

export type BookingState =
  | { status: "idle" }
  | { status: "booked"; ticketId: string; slotStart: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"name" | "phone" | "email", string>>;
      slotTaken?: boolean;
      values?: { name: string; phone: string; email: string };
    };

const MESSAGES = {
  tooMany: "Too many attempts. Wait a minute, then try again.",
  slotTaken: "That time was just taken. Pick another time.",
  slotInPast: "That time has passed. Pick another time.",
  notOffered: "That repair or time is no longer available. Pick again.",
} as const;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

const SlotsInput = z.object({
  repairPriceId: z.string().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const BookingInput = z.object({
  repairPriceId: z.string().min(1).max(64),
  slotStart: z.string().min(1).max(40),
});

export type SlotsResult = { ok: true; slots: string[] } | { ok: false; reason: "rate_limited" | "invalid" };

// Free slots for one repair on one day. Rate limited per IP so the slot
// list cannot be used to hammer the database.
export async function loadSlotsAction(slug: string, repairPriceId: string, date: string): Promise<SlotsResult> {
  const { shopId } = await requireLiveStore(slug, "repair");
  const input = SlotsInput.safeParse({ repairPriceId, date });
  if (!input.success) return { ok: false, reason: "invalid" };
  const ip = clientIp(await headers());
  if (!(await rateLimit(`slots:ip:${ip}`, { capacity: 60, refillPerMinute: 30 }))) {
    return { ok: false, reason: "rate_limited" };
  }
  return { ok: true, slots: await listSlots(shopId, input.data.repairPriceId, input.data.date) };
}

export async function bookRepairAction(slug: string, _prev: BookingState, form: FormData): Promise<BookingState> {
  const { shopId } = await requireLiveStore(slug, "repair");
  const values = { name: text(form, "name"), phone: text(form, "phone"), email: text(form, "email") };

  // A bot filled the hidden field: look like a success, book nothing.
  if (isHoneypotTripped(form)) return { status: "booked", ticketId: "", slotStart: text(form, "slotStart") };

  // Validate everything before taking a rate limit token.
  const ids = BookingInput.safeParse({ repairPriceId: text(form, "repairPriceId"), slotStart: text(form, "slotStart") });
  if (!ids.success) return { status: "error", message: MESSAGES.notOffered, values };
  const parsed = BookingCustomer.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<"name" | "phone" | "email", string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "name" || key === "phone" || key === "email") && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Check the highlighted fields.", fieldErrors, values };
  }

  const ip = clientIp(await headers());
  if (!(await rateLimit(`book:ip:${ip}`, { capacity: 5, refillPerMinute: 1 }))) {
    return { status: "error", message: MESSAGES.tooMany, values };
  }

  const { slotStart } = ids.data;
  const result = await bookRepair(shopId, {
    repairPriceId: ids.data.repairPriceId,
    slotStart,
    customer: parsed.data,
  });
  if (result.ok) return { status: "booked", ticketId: result.value.ticketId, slotStart };
  switch (result.error) {
    case "slot_taken":
      return { status: "error", message: MESSAGES.slotTaken, slotTaken: true, values };
    case "slot_in_past":
      return { status: "error", message: MESSAGES.slotInPast, slotTaken: true, values };
    case "not_offered":
      return { status: "error", message: MESSAGES.notOffered, values };
  }
}
