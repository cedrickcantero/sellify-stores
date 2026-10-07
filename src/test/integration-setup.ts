import { afterAll, beforeAll, beforeEach } from "vitest";
import { closeDb, forShop } from "@/data";
import { closeMaintenancePools, resetTenantData } from "@/data/maintenance";
import { databaseKey } from "./test-database-url";

// Runs in every integration worker. The global setup has already checked
// TEST_DATABASE_URL and pointed DATABASE_URL at it; check again here so a
// worker can never truncate any other database. resetTenantData also
// refuses any database without the test marker table.
const url = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
if (!url || !appUrl || databaseKey(appUrl) !== databaseKey(url)) {
  throw new Error("Refusing to run: integration workers must use TEST_DATABASE_URL.");
}

const WARM_UP_ATTEMPTS = 3;

// Opens the two shared connections (test reset and app client) before the
// first test. A free-tier Neon compute may be waking up, so a failed first
// connection is retried here instead of failing whichever test runs first.
// Later failures are real and are not retried.
beforeAll(async () => {
  for (let attempt = 1; ; attempt++) {
    try {
      await resetTenantData(url);
      await forShop("warm-up").shop.get();
      return;
    } catch (error) {
      if (attempt >= WARM_UP_ATTEMPTS) throw error;
      console.warn(`Test database warm-up failed (attempt ${attempt}), retrying.`, error);
      await closeMaintenancePools();
      await closeDb();
    }
  }
});

beforeEach(async () => {
  await resetTenantData(url);
});

afterAll(async () => {
  await closeMaintenancePools();
  await closeDb();
});
