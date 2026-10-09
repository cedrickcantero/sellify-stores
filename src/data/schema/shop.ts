import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { EmailKind } from "@/domain/email";
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

// Every email Sellify sends for a shop. The row is written (pending) before
// delivery is attempted, then marked sent or failed.
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    recipient: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    kind: text().$type<EmailKind>().notNull(),
    status: text().$type<"pending" | "sent" | "failed">().notNull().default("pending"),
    error: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("email_outbox_shop_created_idx").on(t.shopId, t.createdAt)],
);
