import { runMigrations, seedDeviceCatalog } from "@/data/maintenance";
import { testDatabaseUrl } from "./test-database-url";

// Runs once, in the main process, before the integration workers start.
// Refuses to continue unless TEST_DATABASE_URL is set and differs from
// DATABASE_URL, then points DATABASE_URL at the test database (workers
// inherit it), migrates it and loads the global device catalog.
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl(process.env);
  process.env.DATABASE_URL = url;
  process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-at-least-32-characters";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  await runMigrations(url);
  await seedDeviceCatalog(url);
}
