import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { deviceModel, shop } from "./shop";

// All money is integer cents in EUR.

// What a shop pays for a model and storage size before any deduction.
export const buybackPrice = pgTable(
  "buyback_price",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    deviceModelId: text()
      .notNull()
      .references(() => deviceModel.id),
    storage: text().notNull(),
    basePrice: integer().notNull(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    unique("buyback_price_shop_model_storage_unique").on(
      table.shopId,
      table.deviceModelId,
      table.storage,
    ),
    index("buyback_price_shop_id_idx").on(table.shopId),
  ],
);

// One rule per condition answer. kind "amount" takes `value` off the base
// price; kind "floor" is a fixed offer that replaces it.
export const buybackDeduction = pgTable(
  "buyback_deduction",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    questionKey: text().notNull(),
    answer: boolean().notNull(),
    kind: text().notNull(),
    value: integer().notNull(),
  },
  (table) => [
    unique("buyback_deduction_shop_question_answer_unique").on(
      table.shopId,
      table.questionKey,
      table.answer,
    ),
    index("buyback_deduction_shop_id_idx").on(table.shopId),
  ],
);

// An offer computed on the server. The customer accepts it by id only.
export const buybackQuote = pgTable(
  "buyback_quote",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    deviceModelId: text()
      .notNull()
      .references(() => deviceModel.id),
    storage: text().notNull(),
    answers: jsonb().$type<Record<string, boolean>>().notNull(),
    offer: integer().notNull(),
    // quoted, accepted, received or cancelled
    status: text().notNull().default("quoted"),
    handover: text().notNull().default("drop_in"),
    customerName: text(),
    customerPhone: text(),
    customerEmail: text(),
    expiresAt: timestamp().notNull(),
    acceptedAt: timestamp(),
    receivedAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("buyback_quote_shop_id_idx").on(table.shopId, table.status)],
);
