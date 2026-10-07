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
