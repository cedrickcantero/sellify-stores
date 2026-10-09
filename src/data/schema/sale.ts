import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { product } from "./product";
import { shop } from "./shop";

// A completed or flagged sale, from the POS or the online store. total is in
// cents. stripeSessionId is set on online sales only and is unique, so a
// repeated webhook for the same payment cannot create a second sale.
export const sale = pgTable(
  "sale",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    channel: text({ enum: ["pos", "online"] }).notNull(),
    total: integer().notNull(),
    status: text({ enum: ["completed", "needs_refund"] })
      .notNull()
      .default("completed"),
    stripeSessionId: text().unique(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    check("sale_total_non_negative", sql`${table.total} >= 0`),
    index("sale_shop_created_idx").on(table.shopId, table.createdAt),
  ],
);

// One line of a sale. The title and price are copied at sale time so history
// still reads right after the product is edited or archived.
export const saleItem = pgTable(
  "sale_item",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    saleId: text()
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    productId: text()
      .notNull()
      .references(() => product.id),
    quantity: integer().notNull(),
    titleSnapshot: text().notNull(),
    unitPriceSnapshot: integer().notNull(),
  },
  (table) => [
    check("sale_item_quantity_positive", sql`${table.quantity} > 0`),
    index("sale_item_sale_id_idx").on(table.saleId),
    index("sale_item_product_id_idx").on(table.productId),
  ],
);
