import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Only the data module may reach the database. Everything else imports the
// data module's public index (`@/data`: forShop, resolveShopBySlug, ...),
// never its internals. Scripts and test setup may also use the maintenance
// helpers (migrate, seed, reset), and nothing else inside src/data.
const DATA_INTERNALS = ["@/data/*", "@/data/**", "**/data/*", "**/data/**"];
const MAINTENANCE = ["!@/data/maintenance", "!**/data/maintenance"];
const DRIVER = {
  group: ["@neondatabase/serverless", "drizzle-orm/neon-*", "drizzle-orm/node-postgres"],
  message: "Only src/data may use the database driver. Use forShop() or another export of @/data.",
};

function dataBoundary(allowed) {
  return {
    patterns: [
      {
        group: [...DATA_INTERNALS, ...allowed],
        message:
          "Import from @/data, not from a file inside src/data. Only src/data may reach the database client.",
      },
      DRIVER,
    ],
  };
}

// Backend pages, auth pages and the ui module take colours only from the
// Sellify design tokens (src/app/globals.css). This rejects raw hex, rgb(),
// hsl() and oklch() values, Tailwind palette classes (text-purple-600,
// bg-white) and arbitrary colour classes (bg-[#FAF5FF]) in any string.
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_UTILITY =
  "bg|text|border|border-[trblxy]|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|decoration|shadow|accent|caret";
const RAW_COLOUR = [
  "#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\\w-])",
  "\\b(rgba?|hsla?|oklch|oklab|lab|lch)\\(",
  `\\b(${COLOUR_UTILITY})-(${PALETTE})-[0-9]{2,3}\\b`,
  `\\b(${COLOUR_UTILITY})-(white|black)\\b`,
  `\\b(${COLOUR_UTILITY})-\\[(#|rgb|hsl|oklch|color)`,
].join("|");
const RAW_COLOUR_MESSAGE =
  "Raw colour. Use a Sellify token class (bg-primary, text-muted-foreground, border-border, ...) or a ui component. See docs/brand/sellify.md.";
const BACKEND_SURFACE = ["src/app/(backend)/**/*.{ts,tsx}", "src/app/(auth)/**/*.{ts,tsx}", "src/ui/**/*.{ts,tsx}"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    ignores: ["src/data/**", "scripts/**", "src/test/**"],
    rules: {
      "no-restricted-imports": ["error", dataBoundary([])],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs,ts,mts,cts}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", dataBoundary(MAINTENANCE)],
    },
  },
  {
    files: BACKEND_SURFACE,
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${RAW_COLOUR}/]`, message: RAW_COLOUR_MESSAGE },
        { selector: `TemplateElement[value.raw=/${RAW_COLOUR}/]`, message: RAW_COLOUR_MESSAGE },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "drizzle/**",
  ]),
]);

export default eslintConfig;
