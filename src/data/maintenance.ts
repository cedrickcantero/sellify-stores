import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { DEVICE_CATALOG } from "./device-catalog-data";
import { configureNeonForLocalProxy } from "./neon-local";
import { deviceModel } from "./schema";

// Database maintenance for scripts and test setup. Each function opens its own
// short-lived pool against an explicit URL, so it can target the test
// database without touching DATABASE_URL.

configureNeonForLocalProxy(neonConfig);

async function withDatabase<T>(
  url: string,
  run: (db: ReturnType<typeof drizzle>) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: url });
  try {
    return await run(drizzle({ client: pool, casing: "snake_case" }));
  } finally {
    await pool.end();
  }
}

export async function runMigrations(url: string): Promise<void> {
  await withDatabase(url, (db) => migrate(db, { migrationsFolder: "drizzle" }));
}

// Upserts the global device catalog. Safe to run repeatedly.
export async function seedDeviceCatalog(url: string): Promise<number> {
  return withDatabase(url, async (db) => {
    await db
      .insert(deviceModel)
      .values(DEVICE_CATALOG)
      .onConflictDoUpdate({
        target: deviceModel.id,
        set: {
          brand: sql`excluded.brand`,
          name: sql`excluded.name`,
          storageOptions: sql`excluded.storage_options`,
        },
      });
    return DEVICE_CATALOG.length;
  });
}

// Tables cleared between integration tests. The global device catalog is
// kept. Add every new tenant table here as later tickets create it.
const RESET_TABLES = [
  "shop",
  "invitation",
  "member",
  "organization",
  "session",
  "account",
  "verification",
  "user",
];

// A table that exists only in a database deliberately marked as a test
// database. It is not part of the Drizzle schema, so migrations never create
// it anywhere else. Nothing is ever truncated in a database without it.
const TEST_MARKER_TABLE = "sellify_test_database_marker";
const NOT_MARKED =
  "Refusing to touch this database: it is not marked as a test database. Run `pnpm db:mark-test-database` once against your test branch.";

export async function markTestDatabase(url: string): Promise<void> {
  await withDatabase(url, (db) =>
    db.execute(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS "${TEST_MARKER_TABLE}" (marked_at timestamptz NOT NULL DEFAULT now()); ` +
          `COMMENT ON TABLE "${TEST_MARKER_TABLE}" IS 'Integration tests may truncate this database.'`,
      ),
    ),
  );
}

export async function assertTestDatabaseMarked(url: string): Promise<void> {
  const rows = await withDatabase(url, (db) =>
    db.execute<{ marked: boolean }>(
      sql.raw(`SELECT to_regclass('public.${TEST_MARKER_TABLE}') IS NOT NULL AS marked`),
    ),
  );
  if (!rows.rows[0]?.marked) throw new Error(NOT_MARKED);
}

export async function resetTenantData(url: string): Promise<void> {
  const tables = RESET_TABLES.map((t) => `"${t}"`).join(", ");
  // The marker check and the truncate run as one statement, so the check
  // cannot be skipped or raced.
  await withDatabase(url, (db) =>
    db.execute(
      sql.raw(`DO $$ BEGIN
        IF to_regclass('public.${TEST_MARKER_TABLE}') IS NULL THEN
          RAISE EXCEPTION '${NOT_MARKED.replace(/'/g, "''")}';
        END IF;
        TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;
      END $$`),
    ),
  );
}
