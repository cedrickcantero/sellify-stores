import type { CSSProperties, ReactNode } from "react";
import type { StoreConfig } from "@/domain/store-config";
import { storeThemeVars } from "@/domain/store-theme";
import { storeFontVariables } from "./fonts";

// Sets the store's CSS variables (from its brand settings only) on a full
// page wrapper. Store components style themselves with var(--store-*). The
// base styles that read Sellify variables (heading font, focus ring,
// borders) are pointed at the store's own values inside the wrapper.
export function StoreTheme({ brand, children }: { brand: StoreConfig["brand"]; children: ReactNode }) {
  const vars = storeThemeVars(brand);
  const style = {
    ...vars,
    "--font-heading": "var(--store-font-heading)",
    "--ring": "var(--store-primary)",
    "--border": "color-mix(in srgb, var(--store-text) 15%, transparent)",
    fontFamily: "var(--store-font-body)",
  } as CSSProperties;

  return (
    <div
      className={`${storeFontVariables} flex min-h-dvh flex-1 flex-col bg-(--store-bg) text-(--store-text)`}
      style={style}
    >
      {children}
    </div>
  );
}
