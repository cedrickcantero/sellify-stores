import type { BuybackQuestionKey } from "@/domain/buyback-questions";

// Shared by the Buybacks page (a server component) and the deduction form (a
// client component). It lives outside the client file because a server
// component may only render client exports, not call them.
export function ruleName(key: BuybackQuestionKey, answer: boolean) {
  return `${key}-${answer ? "yes" : "no"}`;
}
