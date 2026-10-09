import { config as loadEnv } from "dotenv";
import { assertTestDatabaseMarked, runMigrations, seedDeviceCatalog } from "@/data/maintenance";
import { testDatabaseUrl } from "./test-database-url";

// Runs once, in the main process, before the integration workers start.
// Loads .env.local (only the integration project sees database URLs),
// refuses to continue unless TEST_DATABASE_URL names a different database
// from DATABASE_URL and that database carries the test marker, then points
// DATABASE_URL at it (workers inherit it), migrates it and loads the global
// device catalog.
export default async function setup(): Promise<void> {
  loadEnv({ path: ".env.local", quiet: true });
  const url = testDatabaseUrl(process.env);
  await assertTestDatabaseMarked(url);

  process.env.DATABASE_URL = url;
  process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-at-least-32-characters";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  await runMigrations(url);
  await seedDeviceCatalog(url);
}
