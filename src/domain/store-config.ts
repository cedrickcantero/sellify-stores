import { z } from "zod";

// The settings of one shop's online store. The owner edits a draft; the
// published copy is what customers see. Every field has a default, so a
// partial or older config parses to a complete one.

export const TEMPLATES = ["clean", "bold", "local"] as const;
export const FONT_PAIRS = ["modern", "slab", "serif"] as const;
export const SLOT_MINUTES = [15, 30, 60] as const;
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const HEX_MESSAGE = "Enter a colour like #0F766E.";
const hex = (fallback: string) =>
  z
    .string({ error: HEX_MESSAGE })
    .regex(/^#[0-9a-fA-F]{6}$/, HEX_MESSAGE)
    .default(fallback);

const TIME_MESSAGE = "Enter a time like 09:00.";
const time = z.string({ error: TIME_MESSAGE }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, TIME_MESSAGE);

const openingDay = z
  .object({ open: time, close: time })
  .refine((day) => day.close > day.open, {
    path: ["close"],
    message: "Closing time must be after opening time.",
  })
  .nullable();

const WEEKDAY_HOURS = { open: "09:00", close: "18:00" };

const text = (max: number, message: string) =>
  z.string({ error: message }).trim().max(max, message).default("");

export const StoreConfig = z.object({
  template: z.enum(TEMPLATES, { error: "Choose Clean, Bold or Local." }).default("clean"),
  brand: z
    .object({
      name: z
        .string({ error: "Enter a store name." })
        .trim()
        .min(1, "Enter a store name.")
        .max(80, "Use 80 characters or fewer for the store name."),
      logoUrl: z
        .url({ protocol: /^https$/, error: "Upload the logo again." })
        .max(2048, "Upload the logo again.")
        .optional(),
      colors: z
        .object({
          primary: hex("#1f2937"),
          accent: hex("#f97316"),
          background: hex("#ffffff"),
          text: hex("#111827"),
        })
        .prefault({}),
      fontPair: z.enum(FONT_PAIRS, { error: "Choose a font pair." }).default("modern"),
      radius: z
        .number({ error: "Enter a corner radius from 0 to 24." })
        .int("Enter a corner radius from 0 to 24.")
        .min(0, "Enter a corner radius from 0 to 24.")
        .max(24, "Enter a corner radius from 0 to 24.")
        .default(8),
    }),
  content: z
    .object({
      banner: z
        .object({
          enabled: z.boolean().default(false),
          text: text(160, "Keep the banner to 160 characters."),
        })
        .prefault({}),
      about: text(2000, "Keep the about text to 2000 characters."),
    })
    .prefault({}),
  contact: z
    .object({
      phone: text(40, "Keep the phone number to 40 characters."),
      email: z
        .union([z.literal(""), z.email({ error: "Enter an email like hello@yourshop.ie." }).max(254)], {
          error: "Enter an email like hello@yourshop.ie.",
        })
        .default(""),
      address: text(200, "Keep the address to 200 characters."),
    })
    .prefault({}),
  openingHours: z
    .object({
      mon: openingDay.default(WEEKDAY_HOURS),
      tue: openingDay.default(WEEKDAY_HOURS),
      wed: openingDay.default(WEEKDAY_HOURS),
      thu: openingDay.default(WEEKDAY_HOURS),
      fri: openingDay.default(WEEKDAY_HOURS),
      sat: openingDay.default({ open: "10:00", close: "16:00" }),
      sun: openingDay.default(null),
    })
    .prefault({}),
  repair: z
    .object({
      slotMinutes: z
        .union([z.literal(15), z.literal(30), z.literal(60)], {
          error: "Choose 15, 30 or 60 minutes.",
        })
        .default(30),
      slotCapacity: z
        .number({ error: "Enter a capacity from 1 to 20." })
        .int("Enter a capacity from 1 to 20.")
        .min(1, "Enter a capacity from 1 to 20.")
        .max(20, "Enter a capacity from 1 to 20.")
        .default(1),
    })
    .prefault({}),
  tabs: z
    .object({
      shop: z.boolean().default(true),
      repair: z.boolean().default(true),
      sell: z.boolean().default(true),
    })
    .prefault({}),
});

export type StoreConfig = z.output<typeof StoreConfig>;

// A patch for any subset of the config, at any depth.
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> | (null extends T[K] ? null : never) }
    : T;

// Field errors keyed by the dotted path of the field: "brand.colors.primary".
export type FieldErrors = Record<string, string>;

export function defaultStoreConfig(shopName: string): StoreConfig {
  return StoreConfig.parse({ brand: { name: shopName.trim().slice(0, 80) || "My store" } });
}

// The first message for each invalid field.
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || "config";
    errors[path] ??= issue.message;
  }
  return errors;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeValue(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base;
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      out[key] = mergeValue(base[key], value);
    }
    return out;
  }
  // Scalars, null (a closed day) and arrays replace what was there.
  return structuredClone(patch);
}

// Applies a patch to a config without changing it. The result is not
// validated; parse it with StoreConfig before storing.
export function mergeStoreConfig(base: StoreConfig, patch: DeepPartial<StoreConfig>): StoreConfig {
  return mergeValue(structuredClone(base), patch) as StoreConfig;
}
