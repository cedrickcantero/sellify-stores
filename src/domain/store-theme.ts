import type { StoreConfig } from "./store-config";

// The store surface is styled only from these CSS variables, derived from
// the store's own brand settings. Nothing on it uses the Sellify tokens.

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#111111";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// White or near-black, whichever reads better on `background`.
export function readableOn(background: string): string {
  return contrast(background, LIGHT_TEXT) >= contrast(background, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

// Heading font per pair; the body is always the sans font. The --font-store-*
// variables are set by the store layout's next/font loaders.
const HEADING_FONTS: Record<StoreConfig["brand"]["fontPair"], string> = {
  modern: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  slab: "var(--font-store-slab), Georgia, serif",
  serif: "var(--font-store-serif), Georgia, serif",
};

export function storeThemeVars(brand: StoreConfig["brand"]): Record<`--store-${string}`, string> {
  const { colors } = brand;
  return {
    "--store-primary": colors.primary,
    "--store-on-primary": readableOn(colors.primary),
    "--store-accent": colors.accent,
    "--store-on-accent": readableOn(colors.accent),
    "--store-bg": colors.background,
    "--store-text": colors.text,
    "--store-radius": `${brand.radius}px`,
    "--store-font-heading": HEADING_FONTS[brand.fontPair],
    "--store-font-body": "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  };
}
