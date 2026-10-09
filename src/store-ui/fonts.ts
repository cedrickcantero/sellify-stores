import { Lora, Roboto_Slab } from "next/font/google";

// Heading fonts a store can pick (StoreConfig brand.fontPair). The body font
// is Inter, loaded by the root layout. See domain/store-theme.
export const storeSlab = Roboto_Slab({ variable: "--font-store-slab", subsets: ["latin"], weight: ["600", "700"] });
export const storeSerif = Lora({ variable: "--font-store-serif", subsets: ["latin"], weight: ["600", "700"] });

export const storeFontVariables = `${storeSlab.variable} ${storeSerif.variable}`;
