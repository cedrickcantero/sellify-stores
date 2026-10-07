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

export async function resetTenantData(url: string): Promise<void> {
  await withDatabase(url, (db) =>
    db.execute(
      sql.raw(`TRUNCATE TABLE ${RESET_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`),
    ),
  );
}
