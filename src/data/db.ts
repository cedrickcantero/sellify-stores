import "server-only";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { configureNeonForLocalProxy } from "./neon-local";
import * as schema from "./schema";

// The database client. Only files inside src/data may import this module;
// an ESLint no-restricted-imports rule enforces it everywhere else.
//
// The WebSocket Pool (not the HTTP driver) is used because later use cases
// (POS sales, order fulfilment) need interactive transactions.

configureNeonForLocalProxy(neonConfig);

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString });
  return drizzle({ client: pool, schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDb>;

let instance: Database | undefined;

// Created on first use so that importing the data module (for example during
// `next build`) does not require a database connection string.
export function getDb(): Database {
  instance ??= createDb();
  return instance;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const real = getDb();
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
