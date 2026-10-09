import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { deviceModel, shop } from "./shop";

// A phone or accessory a shop sells. Price is in cents. images holds public
// image URLs. Stock can never go below zero, enforced by the database.
export const product = pgTable(
  "product",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    title: text().notNull(),
    kind: text({ enum: ["phone", "accessory"] }).notNull(),
    condition: text({ enum: ["new", "like_new", "good", "fair"] }).notNull(),
    price: integer().notNull(),
    stockQty: integer().notNull().default(0),
    images: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    deviceModelId: text().references(() => deviceModel.id, { onDelete: "set null" }),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    check("product_stock_qty_non_negative", sql`${table.stockQty} >= 0`),
    check("product_price_positive", sql`${table.price} > 0`),
    index("product_shop_id_idx").on(table.shopId),
  ],
);
