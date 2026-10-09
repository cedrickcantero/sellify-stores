import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, type Tx } from "../db";
import { product, sale, saleItem } from "../schema";

const LIST_LIMIT = 200;

export type SaleChannel = "pos" | "online";
export type SaleStatus = "completed" | "needs_refund";

export type SaleItem = {
  productId: string;
  /** The product title when it was sold. */
  title: string;
  quantity: number;
  /** Price in cents when it was sold. */
  unitPrice: number;
};

export type SaleWithItems = {
  id: string;
  channel: SaleChannel;
  /** Total in cents. */
  total: number;
  status: SaleStatus;
  createdAt: Date;
  items: SaleItem[];
};

export type SaleFilter = {
  channel?: SaleChannel;
  status?: SaleStatus;
  /** Only sales created at or after this moment. */
  since?: Date;
  /** Only sales created before this moment. */
  until?: Date;
};

export type OnlineSaleInput = {
  stripeSessionId: string;
  items: SaleItem[];
};

export type SalesRepo = {
  /** The shop's newest sales (at most 200), newest first. */
  list(filter?: SaleFilter): Promise<SaleWithItems[]>;
  /** How many sales and their summed totals (cents) match the filter, with no limit. */
  totals(filter?: SaleFilter): Promise<{ count: number; total: number }>;
  /**
   * Inserts a completed online sale and its lines, priced from `items`. A
   * second call with the same Stripe session id changes nothing and returns
   * `{ duplicate: true }`, so the caller must not decrement stock again.
   */
  createOnline(tx: Tx, input: OnlineSaleInput): Promise<{ saleId: string } | { duplicate: true }>;
  /**
   * Inserts a completed POS sale and its lines; the caller has already taken
   * the stock. Returns the saved total in cents.
   */
  createPos(tx: Tx, items: SaleItem[]): Promise<{ saleId: string; total: number }>;
  /**
   * Locks and returns the shop's active products among `ids` (title and
   * current price), so a sale is priced from the database and the price
   * cannot change before the sale commits. Rows are locked in id order, so
   * two sales over the same products never deadlock. `includeArchived` also
   * returns products archived since they were listed (a payment that
   * finishes after a product is removed still needs its title and price).
   */
  lockProducts(
    tx: Tx,
    ids: string[],
    options?: { includeArchived?: boolean },
  ): Promise<{ id: string; title: string; price: number }[]>;
  /** Flags a sale of this shop as paid but not fulfilled. */
  markNeedsRefund(tx: Tx, saleId: string): Promise<void>;
};

/**
 * Takes `qty` units out of stock with one guarded update: it succeeds only
 * when the product belongs to the shop, is not archived and has at least
 * `qty` left. False means nothing changed. Run it inside a transaction.
 *
 * Lock order: a caller that takes several products must first call
 * `sales.lockProducts(tx, ids)` in the same transaction. That locks the rows
 * in id order, so concurrent sales over the same products wait for each
 * other instead of deadlocking. Calling this alone, in an arbitrary order,
 * can deadlock.
 */
export async function decrementStock(
  tx: Tx,
  shopId: string,
  productId: string,
  qty: number,
): Promise<boolean> {
  const rows = await tx
    .update(product)
    .set({ stockQty: sql`${product.stockQty} - ${qty}` })
    .where(
      and(
        eq(product.id, productId),
        eq(product.shopId, shopId),
        isNull(product.archivedAt),
        gte(product.stockQty, qty),
      ),
    )
    .returning({ id: product.id });
  return rows.length > 0;
}

/** Inserts a POS sale and its lines. The caller has already taken the stock. */
async function insertSale(
  tx: Tx,
  shopId: string,
  channel: SaleChannel,
  items: SaleItem[],
  stripeSessionId?: string,
): Promise<{ saleId: string; total: number } | null> {
  if (items.length === 0) throw new Error("A sale needs at least one item");
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const [row] = await tx
    .insert(sale)
    .values({ shopId, channel, total, stripeSessionId })
    .onConflictDoNothing({ target: sale.stripeSessionId })
    .returning({ id: sale.id });
  if (!row) return null;
  await tx.insert(saleItem).values(
    items.map((item) => ({
      saleId: row.id,
      productId: item.productId,
      quantity: item.quantity,
      titleSnapshot: item.title,
      unitPriceSnapshot: item.unitPrice,
    })),
  );
  return { saleId: row.id, total };
}

function salesWhere(shopId: string, filter: SaleFilter) {
  return and(
    eq(sale.shopId, shopId),
    filter.channel ? eq(sale.channel, filter.channel) : undefined,
    filter.status ? eq(sale.status, filter.status) : undefined,
    filter.since ? gte(sale.createdAt, filter.since) : undefined,
    filter.until ? lt(sale.createdAt, filter.until) : undefined,
  );
}

export function salesRepo(shopId: string): SalesRepo {
  return {
    async totals(filter = {}) {
      const [row] = await db
        .select({
          count: sql<number>`count(*)::int`,
          total: sql<number>`coalesce(sum(${sale.total}), 0)::bigint`,
        })
        .from(sale)
        .where(salesWhere(shopId, filter));
      return { count: row.count, total: Number(row.total) };
    },

    async list(filter = {}) {
      const rows = await db
        .select()
        .from(sale)
        .where(salesWhere(shopId, filter))
        .orderBy(desc(sale.createdAt), sale.id)
        .limit(LIST_LIMIT);
      if (rows.length === 0) return [];
      const lines = await db
        .select()
        .from(saleItem)
        .where(
          inArray(
            saleItem.saleId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(saleItem.id);
      return rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        total: row.total,
        status: row.status,
        createdAt: row.createdAt,
        items: lines
          .filter((line) => line.saleId === row.id)
          .map((line) => ({
            productId: line.productId,
            title: line.titleSnapshot,
            quantity: line.quantity,
            unitPrice: line.unitPriceSnapshot,
          })),
      }));
    },

    async createOnline(tx, input) {
      const created = await insertSale(tx, shopId, "online", input.items, input.stripeSessionId);
      return created ? { saleId: created.saleId } : { duplicate: true };
    },

    async createPos(tx, items) {
      const created = await insertSale(tx, shopId, "pos", items);
      if (!created) throw new Error("POS sale was not inserted");
      return created;
    },

    async lockProducts(tx, ids, options = {}) {
      if (ids.length === 0) return [];
      return tx
        .select({ id: product.id, title: product.title, price: product.price })
        .from(product)
        .where(
          and(
            inArray(product.id, ids),
            eq(product.shopId, shopId),
            options.includeArchived ? undefined : isNull(product.archivedAt),
          ),
        )
        .orderBy(product.id)
        .for("update");
    },

    async markNeedsRefund(tx, saleId) {
      await tx
        .update(sale)
        .set({ status: "needs_refund" })
        .where(and(eq(sale.id, saleId), eq(sale.shopId, shopId)));
    },
  };
}
