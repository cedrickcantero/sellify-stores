import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { deviceModel, shop } from "./shop";

export const REPAIR_TICKET_STATUSES = ["booked", "in_progress", "done", "cancelled"] as const;
export const REPAIR_TICKET_SOURCES = ["online", "walk_in"] as const;

export const repairType = pgTable(
  "repair_type",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    name: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique("repair_type_shop_name_unique").on(t.shopId, t.name)],
);

// What a shop charges for one repair on one model. Money is integer cents.
export const repairPrice = pgTable(
  "repair_price",
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
    repairTypeId: text()
      .notNull()
      .references(() => repairType.id, { onDelete: "cascade" }),
    price: integer().notNull(),
    partQty: integer().notNull().default(0),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    unique("repair_price_shop_model_type_unique").on(t.shopId, t.deviceModelId, t.repairTypeId),
    check("repair_price_price_check", sql`${t.price} >= 0`),
    check("repair_price_part_qty_check", sql`${t.partQty} >= 0`),
  ],
);

// A booking or walk-in. slot_seq numbers the tickets sharing one slot start
// (1..capacity); the unique index makes concurrent bookings unable to exceed
// capacity. Cancelled tickets are left out of the index so a cancellation
// frees its place in the slot.
export const repairTicket = pgTable(
  "repair_ticket",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text()
      .notNull()
      .references(() => shop.id, { onDelete: "cascade" }),
    repairPriceId: text()
      .notNull()
      .references(() => repairPrice.id),
    priceSnapshot: integer().notNull(),
    slotStart: timestamp({ withTimezone: true }).notNull(),
    slotSeq: integer().notNull(),
    customerName: text().notNull(),
    customerPhone: text().notNull(),
    customerEmail: text().notNull(),
    status: text({ enum: REPAIR_TICKET_STATUSES }).notNull().default("booked"),
    source: text({ enum: REPAIR_TICKET_SOURCES }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("repair_ticket_shop_slot_seq_unique")
      .on(t.shopId, t.slotStart, t.slotSeq)
      .where(sql`${t.status} <> 'cancelled'`),
    index("repair_ticket_shop_slot_idx").on(t.shopId, t.slotStart),
    check("repair_ticket_slot_seq_check", sql`${t.slotSeq} >= 1`),
    check("repair_ticket_price_check", sql`${t.priceSnapshot} >= 0`),
  ],
);
