import "server-only";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { configureNeon } from "./neon-local";
import * as schema from "./schema";

// The database client. Only files inside src/data may import this module;
// an ESLint no-restricted-imports rule enforces it everywhere else.
//
// The WebSocket Pool (not the HTTP driver) is used because later use cases
// (POS sales, order fulfilment) need interactive transactions. One pool is
// shared per process, so connections are reused rather than re-established.

configureNeon(neonConfig);

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString });
  return { pool, db: drizzle({ client: pool, schema, casing: "snake_case" }) };
}

export type Database = ReturnType<typeof createDb>["db"];

let instance: ReturnType<typeof createDb> | undefined;

// Created on first use so that importing the data module (for example during
// `next build`) does not require a database connection string.
export function getDb(): Database {
  instance ??= createDb();
  return instance.db;
}

// Closes the shared pool. Tests call it when a file finishes so no
// connection is left open for the server to drop.
export async function closeDb(): Promise<void> {
  const current = instance;
  instance = undefined;
  await current?.pool.end();
}

export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const real = getDb();
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** The handle inside `db.transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Either the shared client or a transaction, for repository writes that can join one. */
export type DbExecutor = Database | Tx;
