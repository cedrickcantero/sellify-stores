import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Only the data module may reach the database. Everything else goes through
// the data module's public interface (forShop, resolveShopBySlug, ...).
const databaseImportRestriction = {
  patterns: [
    {
      group: ["**/data/db", "**/data/db.ts"],
      message: "Only src/data may import the database client. Use forShop() or another export of @/data.",
    },
    {
      group: ["@neondatabase/serverless", "drizzle-orm/neon-*", "drizzle-orm/node-postgres"],
      message: "Only src/data may use the database driver. Use forShop() or another export of @/data.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    ignores: ["src/data/**"],
    rules: {
      "no-restricted-imports": ["error", databaseImportRestriction],
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
