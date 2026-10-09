import { and, asc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../db";
import {
  deviceModel,
  repairPrice,
  repairTicket,
  repairType,
  type REPAIR_TICKET_SOURCES,
  type REPAIR_TICKET_STATUSES,
} from "../schema";
import { isUniqueViolation } from "../shops";

export type RepairTicketStatus = (typeof REPAIR_TICKET_STATUSES)[number];
export type RepairTicketSource = (typeof REPAIR_TICKET_SOURCES)[number];

export type RepairType = { id: string; name: string };

/** A shop's price for one repair on one model. Money is integer cents. */
export type RepairPrice = {
  id: string;
  deviceModelId: string;
  repairTypeId: string;
  brand: string;
  modelName: string;
  repairType: string;
  price: number;
  partQty: number;
};

export type OfferedBrand = {
  brand: string;
  models: {
    deviceModelId: string;
    name: string;
    repairs: { repairPriceId: string; repairType: string; price: number; partQty: number }[];
  }[];
};

export type RepairTicket = {
  id: string;
  repairPriceId: string;
  priceSnapshot: number;
  slotStart: Date;
  slotSeq: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  status: RepairTicketStatus;
  source: RepairTicketSource;
  brand: string;
  modelName: string;
  repairType: string;
  createdAt: Date;
};

export type TicketFilter = {
  status?: RepairTicketStatus;
  /** A day, YYYY-MM-DD, in the shop's timezone. */
  date?: string;
  /** Slot starts at or after this instant. Leaves out cancelled tickets. */
  from?: Date;
  limit?: number;
};

export type NewTicket = {
  repairPriceId: string;
  slotStart: Date;
  /** How many tickets the slot holds. The caller reads it from the store config. */
  capacity: number;
  source: RepairTicketSource;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
};

/** The slot has no free place: it is at capacity, or another booking won the last place. */
export class SlotTakenError extends Error {
  constructor() {
    super("That repair slot is full.");
    this.name = "SlotTakenError";
  }
}

export class RepairTypeNotFoundError extends Error {
  constructor() {
    super("Repair type not found for this shop.");
    this.name = "RepairTypeNotFoundError";
  }
}

export class DeviceModelNotFoundError extends Error {
  constructor() {
    super("Device model not found.");
    this.name = "DeviceModelNotFoundError";
  }
}

export type RepairsRepo = {
  listTypes(): Promise<RepairType[]>;
  /** Returns the existing type when the shop already has one with this name. */
  createType(name: string): Promise<RepairType>;
  listPrices(): Promise<RepairPrice[]>;
  upsertPrice(input: {
    deviceModelId: string;
    repairTypeId: string;
    price: number;
    partQty: number;
  }): Promise<RepairPrice>;
  getPrice(repairPriceId: string): Promise<RepairPrice | null>;
  offeredModels(): Promise<OfferedBrand[]>;
  listTickets(filter?: TicketFilter): Promise<RepairTicket[]>;
  /** False when the shop has no such ticket. Throws SlotTakenError when reopening a cancelled ticket whose place was taken. */
  setTicketStatus(ticketId: string, status: RepairTicketStatus): Promise<boolean>;
  /**
   * Non-cancelled tickets per slot start, for slot starts in [start, end).
   * Keys are `Date.toISOString()` UTC strings, for example
   * "2030-01-10T09:00:00.000Z".
   */
  bookedCounts(start: Date, end: Date): Promise<Map<string, number>>;
  /**
   * Takes the lowest free place (1..capacity) in the slot and stores the
   * repair price's current price, read from the database, as the ticket's
   * price snapshot. Pass a transaction to join other writes. Callers must use
   * the default READ COMMITTED isolation: the capacity guard relies on the
   * unique index seeing other transactions' committed and in-flight inserts.
   * Throws SlotTakenError when no place is free.
   */
  insertTicket(
    tx: DbExecutor,
    input: NewTicket,
  ): Promise<{ id: string; slotSeq: number }>;
};

export function repairsRepo(shopId: string): RepairsRepo {
  const priceSelect = {
    id: repairPrice.id,
    deviceModelId: repairPrice.deviceModelId,
    repairTypeId: repairPrice.repairTypeId,
    brand: deviceModel.brand,
    modelName: deviceModel.name,
    repairType: repairType.name,
    price: repairPrice.price,
    partQty: repairPrice.partQty,
  };

  function prices() {
    return db
      .select(priceSelect)
      .from(repairPrice)
      .innerJoin(deviceModel, eq(deviceModel.id, repairPrice.deviceModelId))
      .innerJoin(repairType, eq(repairType.id, repairPrice.repairTypeId));
  }

  async function getPrice(repairPriceId: string): Promise<RepairPrice | null> {
    const rows = await prices().where(
      and(eq(repairPrice.id, repairPriceId), eq(repairPrice.shopId, shopId)),
    );
    return rows[0] ?? null;
  }

  return {
    async listTypes() {
      return db
        .select({ id: repairType.id, name: repairType.name })
        .from(repairType)
        .where(eq(repairType.shopId, shopId))
        .orderBy(asc(repairType.name));
    },

    async createType(name) {
      await db.insert(repairType).values({ shopId, name }).onConflictDoNothing();
      const [row] = await db
        .select({ id: repairType.id, name: repairType.name })
        .from(repairType)
        .where(
          and(eq(repairType.shopId, shopId), sql`lower(${repairType.name}) = lower(${name})`),
        );
      return row;
    },

    async listPrices() {
      return prices()
        .where(eq(repairPrice.shopId, shopId))
        .orderBy(asc(deviceModel.brand), asc(deviceModel.name), asc(repairType.name));
    },

    async upsertPrice(input) {
      // The repair type must be this shop's; the price row inherits shop_id.
      const [type] = await db
        .select({ id: repairType.id })
        .from(repairType)
        .where(and(eq(repairType.id, input.repairTypeId), eq(repairType.shopId, shopId)));
      if (!type) throw new RepairTypeNotFoundError();
      const [model] = await db
        .select({ id: deviceModel.id })
        .from(deviceModel)
        .where(eq(deviceModel.id, input.deviceModelId));
      if (!model) throw new DeviceModelNotFoundError();
      const [row] = await db
        .insert(repairPrice)
        .values({ shopId, ...input })
        .onConflictDoUpdate({
          target: [repairPrice.shopId, repairPrice.deviceModelId, repairPrice.repairTypeId],
          set: { price: input.price, partQty: input.partQty, updatedAt: sql`now()` },
        })
        .returning({ id: repairPrice.id });
      const saved = await getPrice(row.id);
      if (!saved) throw new Error("Repair price vanished after saving.");
      return saved;
    },

    getPrice,

    async offeredModels() {
      const rows = await prices()
        .where(eq(repairPrice.shopId, shopId))
        .orderBy(asc(deviceModel.brand), asc(deviceModel.name), asc(repairType.name));
      const brands: OfferedBrand[] = [];
      for (const row of rows) {
        let brand = brands.find((b) => b.brand === row.brand);
        if (!brand) brands.push((brand = { brand: row.brand, models: [] }));
        let model = brand.models.find((m) => m.deviceModelId === row.deviceModelId);
        if (!model) {
          brand.models.push(
            (model = { deviceModelId: row.deviceModelId, name: row.modelName, repairs: [] }),
          );
        }
        model.repairs.push({
          repairPriceId: row.id,
          repairType: row.repairType,
          price: row.price,
          partQty: row.partQty,
        });
      }
      return brands;
    },

    async listTickets(filter = {}) {
      const conditions = [eq(repairTicket.shopId, shopId)];
      if (filter.status) conditions.push(eq(repairTicket.status, filter.status));
      if (filter.from) {
        conditions.push(gte(repairTicket.slotStart, filter.from), ne(repairTicket.status, "cancelled"));
      }
      if (filter.date) {
        conditions.push(
          sql`(${repairTicket.slotStart} AT TIME ZONE (SELECT timezone FROM shop WHERE id = ${shopId}))::date = ${filter.date}::date`,
        );
      }
      const query = db
        .select({
          id: repairTicket.id,
          repairPriceId: repairTicket.repairPriceId,
          priceSnapshot: repairTicket.priceSnapshot,
          slotStart: repairTicket.slotStart,
          slotSeq: repairTicket.slotSeq,
          customerName: repairTicket.customerName,
          customerPhone: repairTicket.customerPhone,
          customerEmail: repairTicket.customerEmail,
          status: repairTicket.status,
          source: repairTicket.source,
          brand: deviceModel.brand,
          modelName: deviceModel.name,
          repairType: repairType.name,
          createdAt: repairTicket.createdAt,
        })
        .from(repairTicket)
        .innerJoin(repairPrice, eq(repairPrice.id, repairTicket.repairPriceId))
        .innerJoin(deviceModel, eq(deviceModel.id, repairPrice.deviceModelId))
        .innerJoin(repairType, eq(repairType.id, repairPrice.repairTypeId))
        .where(and(...conditions))
        .orderBy(asc(repairTicket.slotStart), asc(repairTicket.slotSeq))
        .$dynamic();
      return filter.limit === undefined ? query : query.limit(filter.limit);
    },

    async setTicketStatus(ticketId, status) {
      try {
        const rows = await db
          .update(repairTicket)
          .set({ status })
          .where(and(eq(repairTicket.id, ticketId), eq(repairTicket.shopId, shopId)))
          .returning({ id: repairTicket.id });
        return rows.length > 0;
      } catch (error) {
        // Reopening a cancelled ticket whose place was booked again.
        if (isUniqueViolation(error)) throw new SlotTakenError();
        throw error;
      }
    },

    async bookedCounts(start, end) {
      const rows = await db
        .select({ slotStart: repairTicket.slotStart, count: sql<number>`count(*)::int` })
        .from(repairTicket)
        .where(
          and(
            eq(repairTicket.shopId, shopId),
            ne(repairTicket.status, "cancelled"),
            gte(repairTicket.slotStart, start),
            lt(repairTicket.slotStart, end),
          ),
        )
        .groupBy(repairTicket.slotStart);
      return new Map(rows.map((r) => [r.slotStart.toISOString(), r.count]));
    },

    async insertTicket(tx, input) {
      const { capacity, ...fields } = input;
      const [price] = await tx
        .select({ id: repairPrice.id, price: repairPrice.price })
        .from(repairPrice)
        .where(and(eq(repairPrice.id, input.repairPriceId), eq(repairPrice.shopId, shopId)));
      if (!price) throw new Error("Repair price not found for this shop.");

      const taken = await tx
        .select({ slotSeq: repairTicket.slotSeq })
        .from(repairTicket)
        .where(
          and(
            eq(repairTicket.shopId, shopId),
            eq(repairTicket.slotStart, input.slotStart),
            ne(repairTicket.status, "cancelled"),
          ),
        );
      const used = new Set(taken.map((t) => t.slotSeq));
      // Try each free place from the lowest. ON CONFLICT DO NOTHING means a
      // concurrent booking that wins a place just moves us to the next one,
      // and it never aborts an enclosing transaction.
      for (let seq = 1; seq <= capacity; seq++) {
        if (used.has(seq)) continue;
        const rows = await tx
          .insert(repairTicket)
          .values({ shopId, slotSeq: seq, priceSnapshot: price.price, ...fields })
          .onConflictDoNothing()
          .returning({ id: repairTicket.id, slotSeq: repairTicket.slotSeq });
        if (rows[0]) return rows[0];
      }
      throw new SlotTakenError();
    },
  };
}
