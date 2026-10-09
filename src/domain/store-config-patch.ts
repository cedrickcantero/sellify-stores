import { z } from "zod";
import type { DeepPartial, StoreConfig } from "./store-config";

// The shape of an editor autosave: any subset of the config at any depth.
// It checks the structure only (known keys, no stray or prototype keys), so
// what reaches the merge is a plain object of the config's own sections. The
// values are checked by saveDraft against StoreConfig, which reports field
// errors in the owner's words.
const value = z.unknown();
const colors = z.strictObject({ primary: value, accent: value, background: value, text: value }).partial();
const day = z.strictObject({ open: value, close: value }).partial().nullable();

export const StoreConfigPatch = z
  .strictObject({
    template: value,
    brand: z.strictObject({ name: value, logoUrl: value, colors, fontPair: value, radius: value }).partial(),
    content: z
      .strictObject({
        banner: z.strictObject({ enabled: value, text: value }).partial(),
        about: value,
      })
      .partial(),
    contact: z.strictObject({ phone: value, email: value, address: value }).partial(),
    openingHours: z
      .strictObject({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day })
      .partial(),
    repair: z.strictObject({ slotMinutes: value, slotCapacity: value }).partial(),
    tabs: z.strictObject({ shop: value, repair: value, sell: value }).partial(),
  })
  .partial();

export function toStoreConfigPatch(input: unknown): DeepPartial<StoreConfig> | null {
  const parsed = StoreConfigPatch.safeParse(input);
  return parsed.success ? (parsed.data as DeepPartial<StoreConfig>) : null;
}
