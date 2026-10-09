import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { DEVICE_CATALOG } from "./device-catalog-data";
import { configureNeon } from "./neon-local";
import { deviceModel } from "./schema";

// Database maintenance for scripts and test setup. Every function takes an
// explicit URL, so it can target the test database without touching
// DATABASE_URL. One-off tasks (migrate, seed, mark) open a short-lived pool;
// the per-test reset reuses one pool per URL until closeMaintenancePools().

configureNeon(neonConfig);

const sharedPools = new Map<string, Pool>();

function sharedDatabase(url: string) {
  let pool = sharedPools.get(url);
  if (!pool) {
    pool = new Pool({ connectionString: url });
    sharedPools.set(url, pool);
  }
  return drizzle({ client: pool, casing: "snake_case" });
}

export async function closeMaintenancePools(): Promise<void> {
  const pools = [...sharedPools.values()];
  sharedPools.clear();
  await Promise.all(pools.map((pool) => pool.end()));
}

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
// kept. Tenant tables that reference shop (products, repairs, outbox, ...)
// are cleared too, through TRUNCATE "shop" ... CASCADE, so they need no entry
// here. Add a table only if it has no foreign key chain to shop.
const RESET_TABLES = [
  "email_outbox",
  "product",
  "store_config_version",
  "store_config",
  "custom_domain",
  "rate_limit_bucket",
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

// Test seeding writes rows, so it checks the marker too; the result is
// cached per URL so seeding stays one round trip per shop.
const markedUrls = new Map<string, Promise<void>>();

function assertMarkedOnce(url: string): Promise<void> {
  let check = markedUrls.get(url);
  if (!check) {
    check = assertTestDatabaseMarked(url).catch((error: unknown) => {
      markedUrls.delete(url);
      throw error;
    });
    markedUrls.set(url, check);
  }
  return check;
}

// Closes the app's shared database client. For test teardown only; loaded
// lazily so scripts that import this module never load the app client.
export async function closeDb(): Promise<void> {
  const { closeDb: close } = await import("./db");
  await close();
}

// Test seeding: a user with an email and password login, an organization
// with the user as owner, and its shop, written in one statement (one round
// trip) instead of the dozen or so sequential queries the sign-up use case
// makes. The sign-up path itself is covered by its own tests.
export async function insertShopWithOwner(
  url: string,
  input: {
    shopName: string;
    slug: string;
    ownerName: string;
    email: string;
    passwordHash: string;
  },
): Promise<{ shopId: string; userId: string }> {
  await assertMarkedOnce(url);
  const userId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const shopId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  await sharedDatabase(url).execute(sql`
    WITH new_user AS (
      INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      VALUES (${userId}, ${input.ownerName}, ${input.email}, false, now(), now())
    ), new_account AS (
      INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
      VALUES (${accountId}, ${userId}, 'credential', ${userId}, ${input.passwordHash}, now(), now())
    ), new_organization AS (
      INSERT INTO organization (id, name, slug, created_at)
      VALUES (${shopId}, ${input.shopName}, ${input.slug}, now())
    ), new_member AS (
      INSERT INTO member (id, organization_id, user_id, role, created_at)
      VALUES (${memberId}, ${shopId}, ${userId}, 'owner', now())
    )
    INSERT INTO shop (id, slug, name) VALUES (${shopId}, ${input.slug}, ${input.shopName})
  `);
  return { shopId, userId };
}

// Test helper: pretends a rate limit bucket was last touched `hours` ago.
export async function ageRateLimitBucket(url: string, key: string, hours: number): Promise<void> {
  await assertMarkedOnce(url);
  await sharedDatabase(url).execute(
    sql`update rate_limit_bucket set updated_at = now() - make_interval(hours => ${hours}::int) where key = ${key}`,
  );
}

export async function resetTenantData(url: string): Promise<void> {
  const tables = RESET_TABLES.map((t) => `"${t}"`).join(", ");
  // The marker check and the truncate run as one statement, so the check
  // cannot be skipped or raced.
  await sharedDatabase(url).execute(
    sql.raw(`DO $$ BEGIN
      IF to_regclass('public.${TEST_MARKER_TABLE}') IS NULL THEN
        RAISE EXCEPTION '${NOT_MARKED.replace(/'/g, "''")}';
      END IF;
      TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;
    END $$`),
  );
}
