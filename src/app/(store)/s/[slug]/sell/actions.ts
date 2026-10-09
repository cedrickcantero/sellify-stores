"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseBuybackCustomer, parseQuoteInput } from "@/domain/buyback-forms";
import { BUYBACK_QUESTIONS } from "@/domain/buyback-questions";
import { createQuote, submitBuyback } from "@/services/buyback";
import { clientIp, isHoneypotTripped, rateLimit } from "@/services/abuse";
import { requireLiveStore } from "../store-context";

// What a Sell form action returns; on success the action redirects instead.
export type SellFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const TRY_AGAIN = "Something went wrong. Try again.";
const TOO_MANY = "Too many tries. Wait a minute, then try again.";

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function offerPath(basePath: string, quoteId: string): string {
  return `${basePath}/sell/offer/${encodeURIComponent(quoteId)}`;
}

// Gets an offer. The store comes from the slug, re-resolved on the server;
// the offer is calculated there from the shop's prices.
export async function getOffer(_previous: SellFormState, form: FormData): Promise<SellFormState> {
  const { shopId, basePath } = await requireLiveStore(text(form, "slug"), "sell");
  if (isHoneypotTripped(form)) return { status: "error", message: TRY_AGAIN };
  if (!(await rateLimit(`quote:ip:${clientIp(await headers())}`, { capacity: 10, refillPerMinute: 5 }))) {
    return { status: "error", message: TOO_MANY };
  }

  const answers: Record<string, boolean> = {};
  for (const question of BUYBACK_QUESTIONS) {
    const value = text(form, question.key);
    if (value === "yes" || value === "no") answers[question.key] = value === "yes";
  }
  const parsed = parseQuoteInput({
    deviceModelId: text(form, "deviceModelId"),
    storage: text(form, "storage"),
    answers,
  });
  if (!parsed.ok) {
    const fieldErrors = { ...parsed.fieldErrors };
    delete fieldErrors.answers;
    for (const question of BUYBACK_QUESTIONS) {
      if (answers[question.key] === undefined) fieldErrors[question.key] = "Answer this question.";
    }
    return { status: "error", fieldErrors };
  }

  const quote = await createQuote(shopId, parsed.value);
  if (!quote.ok) {
    return { status: "error", message: "We are not buying that phone right now. Choose another model or storage size." };
  }
  redirect(offerPath(basePath, quote.value.quoteId));
}

// Accepts the offer for a drop-in handover. Only the quote id comes from the
// browser; the price is whatever the server stored.
export async function acceptOffer(_previous: SellFormState, form: FormData): Promise<SellFormState> {
  const { shopId, basePath } = await requireLiveStore(text(form, "slug"), "sell");
  if (isHoneypotTripped(form)) return { status: "error", message: TRY_AGAIN };
  if (!(await rateLimit(`buyback:ip:${clientIp(await headers())}`, { capacity: 5, refillPerMinute: 1 }))) {
    return { status: "error", message: TOO_MANY };
  }

  const customer = parseBuybackCustomer({
    name: text(form, "name"),
    phone: text(form, "phone"),
    email: text(form, "email"),
  });
  if (!customer.ok) return { status: "error", fieldErrors: customer.fieldErrors };

  const quoteId = text(form, "quoteId");
  const result = await submitBuyback(shopId, quoteId, customer.value);
  if (!result.ok && result.error === "not_found") {
    return { status: "error", message: "We could not find that offer. Get a new one." };
  }
  // Accepted, expired or already accepted: the offer page shows which.
  redirect(offerPath(basePath, quoteId));
}
