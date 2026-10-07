import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url));

// .env.local is loaded only by the integration project's global setup, and
// the unit project strips database settings, so unit tests can never reach a
// database.
export default defineConfig({
  resolve: {
    alias: {
      "@": src,
      // `server-only` throws outside a React Server Components bundle.
      "server-only": serverOnlyStub,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
          setupFiles: ["src/test/unit-setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          globalSetup: ["src/test/integration-global-setup.ts"],
          setupFiles: ["src/test/integration-setup.ts"],
          // One shared test database: run files one at a time.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
