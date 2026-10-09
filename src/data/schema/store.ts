import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { shop } from "./shop";

// Stored configs are validated with the StoreConfig schema (src/domain) on
// every write and read; the column holds its JSON form.
type StoredConfig = Record<string, unknown>;

// One row per shop: the draft the owner edits, the published copy customers
// see (null until the first publish) and whether the store is online.
export const storeConfig = pgTable("store_config", {
  shopId: text()
    .primaryKey()
    .references(() => shop.id, { onDelete: "cascade" }),
  draft: jsonb().$type<StoredConfig>().notNull(),
  published: jsonb().$type<StoredConfig>(),
  online: boolean().notNull().default(false),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// Every publish appends the config it made live.
export const storeConfigVersion = pgTable(
  "store_config_version",
  {
    id: uuid().primaryKey().defaultRandom(),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    config: jsonb().$type<StoredConfig>().notNull(),
    publishedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    publishedBy: text().references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("store_config_version_shop_idx").on(t.shopId, t.publishedAt)],
);

export type DnsRecordRow = { type: "A" | "CNAME" | "TXT"; name: string; value: string };

// A hostname a shop wants its store served on. Only a verified one resolves.
export const customDomain = pgTable(
  "custom_domain",
  {
    id: uuid().primaryKey().defaultRandom(),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    hostname: text().notNull().unique(),
    status: text({ enum: ["pending", "verified", "error"] }).notNull().default("pending"),
    dnsRecords: jsonb().$type<DnsRecordRow[]>().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("custom_domain_shop_idx").on(t.shopId),
    check("custom_domain_status_check", sql`${t.status} in ('pending', 'verified', 'error')`),
    check("custom_domain_hostname_lower_check", sql`${t.hostname} = lower(${t.hostname})`),
  ],
);

// Token buckets for rate limiting public endpoints and auth forms. Not a
// tenant table: the key names the caller ("book:ip:203.0.113.7").
export const rateLimitBucket = pgTable("rate_limit_bucket", {
  key: text().primaryKey(),
  tokens: doublePrecision().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
