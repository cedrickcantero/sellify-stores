import { config as loadEnv } from "dotenv";
import { markTestDatabase } from "../src/data/maintenance";
import { databaseKey, testDatabaseUrl } from "../src/test/test-database-url";

loadEnv({ path: ".env.local", quiet: true });

// One-off: marks the database at TEST_DATABASE_URL as a test database, which
// integration tests require before they truncate anything. Run it only
// against a dedicated test branch.
const url = testDatabaseUrl(process.env);
await markTestDatabase(url);
console.log(`Marked ${databaseKey(url)} as the integration test database.`);
