import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { BuybackQuestionKey } from "@/domain/buyback-questions";
import { db } from "../db";
import { buybackDeduction, buybackPrice, buybackQuote, deviceModel } from "../schema";

export type { BuybackQuestionKey };

// All amounts are integer cents. kind "amount" is taken off the base price;
// kind "floor" is a fixed offer (for example a phone that will not turn on).
export type BuybackDeduction = {
  questionKey: BuybackQuestionKey;
  answer: boolean;
  kind: "amount" | "floor";
  value: number;
};

export type BuybackStatus = "quoted" | "accepted" | "received" | "cancelled";

export type BuybackCustomer = { name: string; phone: string; email: string };

export type BuybackQuote = {
  id: string;
  deviceModelId: string;
  storage: string;
  answers: Record<string, boolean>;
  offer: number;
  status: BuybackStatus;
  handover: "drop_in";
  customer: BuybackCustomer | null;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  receivedAt: Date | null;
};

export type BuybackQuoteListItem = BuybackQuote & { brand: string; deviceName: string };

export type BasePriceRow = {
  deviceModelId: string;
  storage: string;
  basePrice: number;
};

export type OfferedBrand = {
  brand: string;
  models: { deviceModelId: string; name: string; storages: string[] }[];
};

export type BuybackRepo = {
  upsertBasePrice(input: BasePriceRow): Promise<void>;
  getBasePrice(deviceModelId: string, storage: string): Promise<number | null>;
  listBasePrices(): Promise<BasePriceRow[]>;
  /** Brands and models the shop has a base price for, with those storages. */
  offeredModels(): Promise<OfferedBrand[]>;
  setDeduction(rule: BuybackDeduction): Promise<void>;
  removeDeduction(questionKey: BuybackQuestionKey, answer: boolean): Promise<void>;
  listDeductions(): Promise<BuybackDeduction[]>;
  insertQuote(input: {
    deviceModelId: string;
    storage: string;
    answers: Record<string, boolean>;
    offer: number;
    expiresAt: Date;
  }): Promise<BuybackQuote>;
  getQuote(id: string): Promise<BuybackQuote | null>;
  /**
   * Atomically moves a quoted, unexpired quote to accepted (drop-in) and
   * stores the customer. Returns false, changing nothing, when the quote is
   * unknown, belongs to another shop, is not quoted or has expired, so a
   * double accept can win only once.
   */
  acceptQuote(id: string, customer: BuybackCustomer, now?: Date): Promise<boolean>;
  listQuotes(filter?: { statuses?: BuybackStatus[] }): Promise<BuybackQuoteListItem[]>;
  /** Moves an accepted quote to received. Returns false for any other state. */
  markReceived(id: string): Promise<boolean>;
};

type QuoteRow = typeof buybackQuote.$inferSelect;

function toQuote(row: QuoteRow): BuybackQuote {
  return {
    id: row.id,
    deviceModelId: row.deviceModelId,
    storage: row.storage,
    answers: row.answers,
    offer: row.offer,
    status: row.status as BuybackStatus,
    handover: "drop_in",
    customer:
      row.customerName && row.customerPhone && row.customerEmail
        ? { name: row.customerName, phone: row.customerPhone, email: row.customerEmail }
        : null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    receivedAt: row.receivedAt,
  };
}

export function buybackRepo(shopId: string): BuybackRepo {
  return {
    async upsertBasePrice({ deviceModelId, storage, basePrice }) {
      await db
        .insert(buybackPrice)
        .values({ shopId, deviceModelId, storage, basePrice })
        .onConflictDoUpdate({
          target: [buybackPrice.shopId, buybackPrice.deviceModelId, buybackPrice.storage],
          set: { basePrice, updatedAt: new Date() },
        });
    },

    async getBasePrice(deviceModelId, storage) {
      const rows = await db
        .select({ basePrice: buybackPrice.basePrice })
        .from(buybackPrice)
        .where(
          and(
            eq(buybackPrice.shopId, shopId),
            eq(buybackPrice.deviceModelId, deviceModelId),
            eq(buybackPrice.storage, storage),
          ),
        )
        .limit(1);
      return rows[0]?.basePrice ?? null;
    },

    async listBasePrices() {
      return db
        .select({
          deviceModelId: buybackPrice.deviceModelId,
          storage: buybackPrice.storage,
          basePrice: buybackPrice.basePrice,
        })
        .from(buybackPrice)
        .where(eq(buybackPrice.shopId, shopId))
        .orderBy(asc(buybackPrice.deviceModelId), asc(buybackPrice.storage));
    },

    async offeredModels() {
      const rows = await db
        .select({
          brand: deviceModel.brand,
          deviceModelId: deviceModel.id,
          name: deviceModel.name,
          storage: buybackPrice.storage,
        })
        .from(buybackPrice)
        .innerJoin(deviceModel, eq(deviceModel.id, buybackPrice.deviceModelId))
        .where(eq(buybackPrice.shopId, shopId))
        .orderBy(asc(deviceModel.brand), asc(deviceModel.name), asc(buybackPrice.storage));

      const brands: OfferedBrand[] = [];
      for (const row of rows) {
        let brand = brands.find((b) => b.brand === row.brand);
        if (!brand) {
          brand = { brand: row.brand, models: [] };
          brands.push(brand);
        }
        let model = brand.models.find((m) => m.deviceModelId === row.deviceModelId);
        if (!model) {
          model = { deviceModelId: row.deviceModelId, name: row.name, storages: [] };
          brand.models.push(model);
        }
        model.storages.push(row.storage);
      }
      return brands;
    },

    async setDeduction({ questionKey, answer, kind, value }) {
      await db
        .insert(buybackDeduction)
        .values({ shopId, questionKey, answer, kind, value })
        .onConflictDoUpdate({
          target: [buybackDeduction.shopId, buybackDeduction.questionKey, buybackDeduction.answer],
          set: { kind, value },
        });
    },

    async removeDeduction(questionKey, answer) {
      await db
        .delete(buybackDeduction)
        .where(
          and(
            eq(buybackDeduction.shopId, shopId),
            eq(buybackDeduction.questionKey, questionKey),
            eq(buybackDeduction.answer, answer),
          ),
        );
    },

    async listDeductions() {
      const rows = await db
        .select({
          questionKey: buybackDeduction.questionKey,
          answer: buybackDeduction.answer,
          kind: buybackDeduction.kind,
          value: buybackDeduction.value,
        })
        .from(buybackDeduction)
        .where(eq(buybackDeduction.shopId, shopId))
        .orderBy(asc(buybackDeduction.questionKey), asc(buybackDeduction.answer));
      return rows as BuybackDeduction[];
    },

    async insertQuote(input) {
      const [row] = await db
        .insert(buybackQuote)
        .values({ shopId, ...input })
        .returning();
      return toQuote(row);
    },

    async getQuote(id) {
      const rows = await db
        .select()
        .from(buybackQuote)
        .where(and(eq(buybackQuote.shopId, shopId), eq(buybackQuote.id, id)))
        .limit(1);
      return rows[0] ? toQuote(rows[0]) : null;
    },

    async acceptQuote(id, customer, now = new Date()) {
      const rows = await db
        .update(buybackQuote)
        .set({
          status: "accepted",
          handover: "drop_in",
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          acceptedAt: now,
        })
        .where(
          and(
            eq(buybackQuote.shopId, shopId),
            eq(buybackQuote.id, id),
            eq(buybackQuote.status, "quoted"),
            gt(buybackQuote.expiresAt, now),
          ),
        )
        .returning({ id: buybackQuote.id });
      return rows.length === 1;
    },

    async listQuotes(filter) {
      const conditions = [eq(buybackQuote.shopId, shopId)];
      if (filter?.statuses?.length) conditions.push(inArray(buybackQuote.status, filter.statuses));
      const rows = await db
        .select({
          quote: buybackQuote,
          brand: deviceModel.brand,
          deviceName: deviceModel.name,
        })
        .from(buybackQuote)
        .innerJoin(deviceModel, eq(deviceModel.id, buybackQuote.deviceModelId))
        .where(and(...conditions))
        .orderBy(desc(sql`coalesce(${buybackQuote.acceptedAt}, ${buybackQuote.createdAt})`));
      return rows.map((r) => ({ ...toQuote(r.quote), brand: r.brand, deviceName: r.deviceName }));
    },

    async markReceived(id) {
      const rows = await db
        .update(buybackQuote)
        .set({ status: "received", receivedAt: new Date() })
        .where(
          and(
            eq(buybackQuote.shopId, shopId),
            eq(buybackQuote.id, id),
            eq(buybackQuote.status, "accepted"),
          ),
        )
        .returning({ id: buybackQuote.id });
      return rows.length === 1;
    },
  };
}
