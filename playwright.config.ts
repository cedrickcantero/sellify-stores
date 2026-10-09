import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against PLAYWRIGHT_BASE_URL (for example a Vercel preview
// URL). Without it, a local dev server is started on port 3000.
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: baseURL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // Lets the smoke test through Vercel deployment protection on previews.
    extraHTTPHeaders: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: baseURL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        // Smoke tests sign up and log in repeatedly; the override is
        // ignored in production and on Vercel.
        env: { RATE_LIMIT_DISABLED: "1" },
        timeout: 120_000,
      },
});
