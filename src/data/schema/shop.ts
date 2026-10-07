import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";

// A shop is the tenant. Its id is the id of the Better Auth organization that
// owns it, so the session's active organization id is the shop id.
export const shop = pgTable("shop", {
  id: text()
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  slug: text().notNull().unique(),
  name: text().notNull(),
  timezone: text().notNull().default("Europe/Dublin"),
  createdAt: timestamp().notNull().defaultNow(),
});

// Global, seeded, read-only catalog of device models shared by all shops.
export const deviceModel = pgTable("device_model", {
  id: text().primaryKey(),
  brand: text().notNull(),
  name: text().notNull(),
  storageOptions: text().array().notNull(),
});
