import type { BuybackDeduction } from "@/data";

// The offer for a phone, in integer cents. Starts at the shop's base price
// and takes off every matching amount deduction. If any matching rule is a
// floor, the offer becomes the lowest matching floor value instead. Never
// below zero. A rule matches when the customer's answer to its question
// equals the rule's answer.
export function quoteBuyback(
  basePrice: number,
  deductions: BuybackDeduction[],
  answers: Record<BuybackDeduction["questionKey"], boolean>,
): number {
  const matching = deductions.filter((rule) => answers[rule.questionKey] === rule.answer);
  const floors = matching.filter((rule) => rule.kind === "floor").map((rule) => rule.value);
  if (floors.length > 0) return Math.max(0, Math.min(...floors));
  const taken = matching.filter((rule) => rule.kind === "amount").reduce((sum, rule) => sum + rule.value, 0);
  return Math.max(0, basePrice - taken);
}
