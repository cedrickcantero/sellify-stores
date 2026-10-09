import { expect, test } from "@playwright/test";

test("an address that matches no store is not found", async ({ page }) => {
  const response = await page.goto("/s/no-such-store-e2e");
  expect(response?.status()).toBe(404);
});

test("the proxy's internal store host path is not a store on the app host", async ({ page }) => {
  const response = await page.goto("/s/_host");
  expect(response?.status()).toBe(404);
});
