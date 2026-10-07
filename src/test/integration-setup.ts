import { beforeEach } from "vitest";
import { resetTenantData } from "@/data/maintenance";
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

beforeEach(async () => {
  await resetTenantData(url);
});
