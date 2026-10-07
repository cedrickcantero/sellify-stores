import { beforeEach } from "vitest";
import { resetTenantData } from "@/data/maintenance";

// Runs in every integration worker. The global setup has already checked
// TEST_DATABASE_URL and pointed DATABASE_URL at it; check again here so a
// worker can never truncate any other database.
const url = process.env.TEST_DATABASE_URL;
if (!url || process.env.DATABASE_URL !== url) {
  throw new Error("Refusing to run: integration workers must use TEST_DATABASE_URL.");
}

beforeEach(async () => {
  await resetTenantData(url);
});
