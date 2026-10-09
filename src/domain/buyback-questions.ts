export type BuybackQuestionKey = "screen_cracked" | "battery_ok" | "powers_on";

// The three condition questions a customer answers, in display order.
export const BUYBACK_QUESTIONS: {
  key: BuybackQuestionKey;
  label: string;
  yes: string;
  no: string;
}[] = [
  { key: "screen_cracked", label: "Screen cracked", yes: "Screen cracked", no: "Screen not cracked" },
  { key: "battery_ok", label: "Battery OK", yes: "Battery OK", no: "Battery needs replacing" },
  { key: "powers_on", label: "Powers on", yes: "Turns on", no: "Does not turn on" },
];

// Euro text ("250", "12,50") to integer cents; null when it is not an amount
// of at most two decimals.
export function parseEuros(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function formatEuros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

// "Screen cracked, battery needs replacing, turns on"
export function answersSummary(answers: Record<string, boolean>): string {
  const parts = BUYBACK_QUESTIONS.filter((q) => q.key in answers).map((q, index) => {
    const text = answers[q.key] ? q.yes : q.no;
    // Only the first word of the sentence keeps its capital.
    return index === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
  });
  return parts.join(", ");
}
