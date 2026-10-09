import { and, desc, eq, gt, type SQL } from "drizzle-orm";
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

export type ProductRepo = {
  list(filter?: ProductFilter): Promise<Product[]>;
  get(id: string): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  /** Null when the product does not exist in this shop. */
  update(id: string, input: ProductInput): Promise<Product | null>;
  /** False when the product does not exist in this shop. */
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

  return {
    async list(filter = {}) {
      const conditions: SQL[] = [eq(product.shopId, shopId)];
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

    async get(id) {
      const rows = await db.select().from(product).where(mine(id)).limit(1);
      return rows[0] ? toProduct(rows[0]) : null;
    },

    async create(input) {
      const [row] = await db
        .insert(product)
        .values({ ...columns(input), shopId })
        .returning();
      return toProduct(row);
    },

    async update(id, input) {
      const [row] = await db.update(product).set(columns(input)).where(mine(id)).returning();
      return row ? toProduct(row) : null;
    },

    async remove(id) {
      const rows = await db.delete(product).where(mine(id)).returning({ id: product.id });
      return rows.length > 0;
    },
  };
}
