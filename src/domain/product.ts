import { z } from "zod";
import { err, ok, type Result } from "./result";

export const PRODUCT_KINDS = ["phone", "accessory"] as const;
export const PRODUCT_CONDITIONS = [
  "new",
  "refurbished",
  "like_new",
  "good",
  "fair",
  "used",
] as const;
export const MAX_PRICE_CENTS = 10_000_000;
export const MAX_PRODUCT_IMAGES = 8;

export type ProductKind = (typeof PRODUCT_KINDS)[number];
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const KIND_LABELS: Record<ProductKind, string> = {
  phone: "Phone",
  accessory: "Accessory",
};

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: "New",
  refurbished: "Refurbished",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  used: "Used",
};

// What a shop owner can set on a product. Price is in cents.
export type ProductInput = {
  title: string;
  kind: ProductKind;
  condition: ProductCondition;
  price: number;
  stockQty: number;
  images: string[];
  deviceModelId: string | null;
};

const PRICE_TEXT = /^\d+([.,]\d{1,2})?$/;

// "349.50" or "349,5" in euros to whole cents. Null for anything that is not
// a price above zero, up to €100,000, with at most two decimals.
export function priceToCents(text: string): number | null {
  const trimmed = text.trim();
  if (!PRICE_TEXT.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_PRICE_CENTS ? cents : null;
}

export function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function stockStatus(stockQty: number): "in_stock" | "sold_out" {
  return stockQty > 0 ? "in_stock" : "sold_out";
}

export type ProductFormValues = {
  title: string;
  kind: string;
  condition: string;
  price: string;
  stockQty: string;
  deviceModelId: string;
  images: string[];
};

export type ProductFieldErrors = Partial<Record<keyof ProductFormValues, string>>;

const productSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120, "Use 120 characters or fewer."),
  kind: z.enum(PRODUCT_KINDS, "Choose phone or accessory."),
  condition: z.enum(PRODUCT_CONDITIONS, "Choose a condition."),
  price: z.string().transform((text, ctx) => {
    const cents = priceToCents(text);
    if (cents === null) {
      const typed = text.trim();
      const tooHigh = PRICE_TEXT.test(typed) && Number(typed.replace(",", ".")) > 0;
      ctx.addIssue({
        code: "custom",
        message: tooHigh ? "Enter a price up to €100,000." : "Enter a price above 0.",
      });
    }
    return cents ?? 0;
  }),
  stockQty: z
    .string()
    .trim()
    .regex(/^\d{1,9}$/, "Enter a whole number, 0 or more.")
    .transform(Number),
  deviceModelId: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || null),
  images: z
    .array(z.string().trim().min(1))
    .max(MAX_PRODUCT_IMAGES, `Add up to ${MAX_PRODUCT_IMAGES} photos.`),
});

// Validates the product form's raw text values. On failure returns one
// plain-words message per bad field.
export function parseProductForm(
  values: ProductFormValues,
): Result<ProductInput, ProductFieldErrors> {
  const parsed = productSchema.safeParse(values);
  if (parsed.success) return ok(parsed.data);
  const errors: ProductFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof ProductFormValues;
    errors[field] ??= issue.message;
  }
  return err(errors);
}
