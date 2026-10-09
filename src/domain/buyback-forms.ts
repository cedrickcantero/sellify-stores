import { z } from "zod";
import { BUYBACK_QUESTIONS, parseEuros, type BuybackQuestionKey } from "./buyback-questions";

export const MAX_CENTS = 10_000_000;
export const MAX_EUROS_MESSAGE = "Enter an amount below €100,000.";

export type ParsedForm<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: Record<string, string> };

// Euro text to integer cents, with the field error for each way it can fail.
function euros(options: { min: number; notAnAmount: string }) {
  return z
    .string()
    .transform((text, ctx) => {
      const cents = parseEuros(text);
      if (cents === null) {
        ctx.issues.push({ code: "custom", message: options.notAnAmount, input: text });
        return z.NEVER;
      }
      return cents;
    })
    .pipe(
      z
        .number()
        .int()
        .min(options.min, options.notAnAmount)
        .max(MAX_CENTS, MAX_EUROS_MESSAGE),
    );
}

function firstErrors(error: z.ZodError, nameOf: (path: PropertyKey[]) => string) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const name = nameOf(issue.path);
    if (!(name in fieldErrors)) fieldErrors[name] = issue.message;
  }
  return fieldErrors;
}

const basePriceSchema = z.object({
  deviceModelId: z.string().min(1, "Choose a model."),
  storage: z.string().min(1, "Choose a storage size."),
  basePrice: euros({ min: 1, notAnAmount: "Enter a price above 0." }),
});

export type BasePriceInput = z.infer<typeof basePriceSchema>;

export function parseBasePriceForm(input: Record<string, string>): ParsedForm<BasePriceInput> {
  const parsed = basePriceSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, fieldErrors: firstErrors(parsed.error, (path) => String(path[0])) };
}

export type ParsedDeduction = {
  questionKey: BuybackQuestionKey;
  answer: boolean;
  kind: "amount" | "floor";
  value: number;
};

const ruleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.enum(["amount", "floor"]),
    value: euros({ min: 0, notAnAmount: "Enter an amount, for example 25 or 12.50." }),
  }),
]);

// `input` holds the form's fields: "<question>-<yes|no>-kind" and
// "<question>-<yes|no>-value". Rules set to none are left out.
export function parseDeductionsForm(input: Record<string, string>): ParsedForm<ParsedDeduction[]> {
  const rules: ParsedDeduction[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const question of BUYBACK_QUESTIONS) {
    for (const answer of [true, false]) {
      const name = `${question.key}-${answer ? "yes" : "no"}`;
      const parsed = ruleSchema.safeParse({
        kind: input[`${name}-kind`] ?? "none",
        value: input[`${name}-value`] ?? "",
      });
      if (!parsed.success) {
        const unknownKind = parsed.error.issues.some((i) => i.path[0] === "kind");
        fieldErrors[name] = unknownKind
          ? "Choose no change, deduct amount or fixed offer."
          : parsed.error.issues[0].message;
      } else if (parsed.data.kind !== "none") {
        rules.push({
          questionKey: question.key,
          answer,
          kind: parsed.data.kind,
          value: parsed.data.value,
        });
      }
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: rules };
}

const quoteIdSchema = z.string().min(1).max(64);

export function parseQuoteId(input: unknown): string | null {
  const parsed = quoteIdSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

const quoteInputSchema = z.object({
  deviceModelId: z.string().min(1, "Choose a model.").max(100, "Choose a model."),
  storage: z.string().min(1, "Choose a storage size.").max(40, "Choose a storage size."),
  answers: z.object(
    Object.fromEntries(
      BUYBACK_QUESTIONS.map((q) => [q.key, z.boolean({ error: "Answer every question." })]),
    ) as Record<BuybackQuestionKey, z.ZodBoolean>,
  ),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;

// What a customer sends to get an offer: the model, the storage size and a
// yes or no for each of the three condition questions.
export function parseQuoteInput(input: unknown): ParsedForm<QuoteInput> {
  const parsed = quoteInputSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, fieldErrors: firstErrors(parsed.error, (path) => String(path[0])) };
}

const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Keep your name to 80 characters."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{6,25}$/, "Enter a phone number like 085 123 4567."),
  email: z
    .string()
    .trim()
    .max(254, "Enter an email like you@example.com.")
    .pipe(z.email({ error: "Enter an email like you@example.com." })),
});

export type BuybackCustomerInput = z.infer<typeof customerSchema>;

export function parseBuybackCustomer(input: Record<string, string>): ParsedForm<BuybackCustomerInput> {
  const parsed = customerSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, fieldErrors: firstErrors(parsed.error, (path) => String(path[0])) };
}
