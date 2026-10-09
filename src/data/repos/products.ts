import { and, desc, eq, gt, isNull, type SQL } from "drizzle-orm";
import type { ProductCondition, ProductInput, ProductKind } from "@/domain/product";
import { db } from "../db";
import { product } from "../schema";

export type Product = {
  id: string;
  shopId: string;
  title: string;
  kind: ProductKind;
  condition: ProductCondition;
  /** Price in cents. */
  price: number;
  stockQty: number;
  images: string[];
  deviceModelId?: string;
};

export type ProductFilter = {
  kind?: ProductKind;
  condition?: ProductCondition;
  stock?: "in" | "out";
};

export type UpdateProductResult =
  | { ok: true; product: Product }
  | { ok: false; reason: "not_found" | "stock_changed" };

export type ProductRepo = {
  /** Active (not archived) products, newest first. */
  list(filter?: ProductFilter): Promise<Product[]>;
  /** Archived products are hidden unless `includeArchived` is set. */
  get(id: string, options?: { includeArchived?: boolean }): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  /**
   * Saves an edit only if the stock is still `expectedStockQty`, the value
   * the editor saw, so a sale made meanwhile is never overwritten.
   */
  update(id: string, input: ProductInput, expectedStockQty: number): Promise<UpdateProductResult>;
  /** Archives the product. False when it is not an active product of this shop. */
  remove(id: string): Promise<boolean>;
};

function toProduct(row: typeof product.$inferSelect): Product {
  return {
    id: row.id,
    shopId: row.shopId,
    title: row.title,
    kind: row.kind,
    condition: row.condition,
    price: row.price,
    stockQty: row.stockQty,
    images: row.images,
    ...(row.deviceModelId ? { deviceModelId: row.deviceModelId } : {}),
  };
}

function columns(input: ProductInput) {
  return {
    title: input.title,
    kind: input.kind,
    condition: input.condition,
    price: input.price,
    stockQty: input.stockQty,
    images: input.images,
    deviceModelId: input.deviceModelId,
  };
}

export function productRepo(shopId: string): ProductRepo {
  // Every query below is filtered by shopId.
  const mine = (id: string) => and(eq(product.shopId, shopId), eq(product.id, id));
  const active = (id: string) => and(mine(id), isNull(product.archivedAt));

  async function get(id: string, options: { includeArchived?: boolean } = {}) {
    const rows = await db
      .select()
      .from(product)
      .where(options.includeArchived ? mine(id) : active(id))
      .limit(1);
    return rows[0] ? toProduct(rows[0]) : null;
  }

  return {
    get,

    async list(filter = {}) {
      const conditions: SQL[] = [eq(product.shopId, shopId), isNull(product.archivedAt)];
      if (filter.kind) conditions.push(eq(product.kind, filter.kind));
      if (filter.condition) conditions.push(eq(product.condition, filter.condition));
      if (filter.stock === "in") conditions.push(gt(product.stockQty, 0));
      if (filter.stock === "out") conditions.push(eq(product.stockQty, 0));
      const rows = await db
        .select()
        .from(product)
        .where(and(...conditions))
        .orderBy(desc(product.createdAt), product.id);
      return rows.map(toProduct);
    },

    async create(input) {
      const [row] = await db
        .insert(product)
        .values({ ...columns(input), shopId })
        .returning();
      return toProduct(row);
    },

    async update(id, input, expectedStockQty) {
      const [row] = await db
        .update(product)
        .set(columns(input))
        .where(and(active(id), eq(product.stockQty, expectedStockQty)))
        .returning();
      if (row) return { ok: true, product: toProduct(row) };
      // No row changed: either the product is gone or its stock moved.
      return { ok: false, reason: (await get(id)) ? "stock_changed" : "not_found" };
    },

    async remove(id) {
      const rows = await db
        .update(product)
        .set({ archivedAt: new Date() })
        .where(active(id))
        .returning({ id: product.id });
      return rows.length > 0;
    },
  };
}
