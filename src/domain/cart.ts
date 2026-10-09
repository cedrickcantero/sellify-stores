import { z } from "zod";

export const MAX_CART_LINES = 20;
export const MIN_LINE_QTY = 1;
export const MAX_LINE_QTY = 99;

// A basket line is only a product id and a quantity. Prices always come from
// the server's products, never from the basket.
export type CartLine = { productId: string; qty: number };

const lineSchema = z.object({
  productId: z.string().min(1).max(100),
  qty: z.number().int().min(MIN_LINE_QTY).max(MAX_LINE_QTY),
});

// Reads the basket cookie's text. Anything unreadable gives an empty basket;
// a malformed line is dropped, repeats of a product are merged, and the
// basket is cut to MAX_CART_LINES.
export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const merged = new Map<string, number>();
  for (const item of data) {
    const parsed = lineSchema.safeParse(item);
    if (!parsed.success) continue;
    const { productId, qty } = parsed.data;
    if (!merged.has(productId) && merged.size >= MAX_CART_LINES) continue;
    merged.set(productId, Math.min((merged.get(productId) ?? 0) + qty, MAX_LINE_QTY));
  }
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify(lines.map(({ productId, qty }) => ({ productId, qty })));
}

// The basket with a product's quantity set to `qty`, never above `stockQty`
// or MAX_LINE_QTY. Zero, negative, NaN or no stock removes the line; a new
// line is ignored once the basket already has MAX_CART_LINES.
export function setLineQty(lines: CartLine[], productId: string, qty: number, stockQty: number): CartLine[] {
  const capped = Math.min(Math.floor(qty), stockQty, MAX_LINE_QTY);
  const others = lines.filter((line) => line.productId !== productId);
  if (!(capped >= MIN_LINE_QTY)) return others;
  if (others.length === lines.length) {
    return lines.length >= MAX_CART_LINES ? lines : [...lines, { productId, qty: capped }];
  }
  return lines.map((line) => (line.productId === productId ? { productId, qty: capped } : line));
}

// The basket as it can be bought right now: quantities capped at current
// stock, lines for sold out or unknown products dropped.
export function clampToStock(lines: CartLine[], products: { id: string; stockQty: number }[]): CartLine[] {
  const stock = new Map(products.map((product) => [product.id, product.stockQty]));
  return lines.flatMap(({ productId, qty }) => {
    const capped = Math.min(qty, stock.get(productId) ?? 0);
    return capped >= MIN_LINE_QTY ? [{ productId, qty: capped }] : [];
  });
}

// Prices a basket from the products the server loaded. Lines whose product
// is not in `products` (unknown or archived) are dropped. Amounts in cents.
export function cartTotals<P extends { id: string; price: number }>(
  lines: CartLine[],
  products: P[],
): { lines: { product: P; qty: number; lineTotal: number }[]; total: number } {
  const byId = new Map(products.map((product) => [product.id, product]));
  const priced = lines.flatMap(({ productId, qty }) => {
    const product = byId.get(productId);
    return product ? [{ product, qty, lineTotal: product.price * qty }] : [];
  });
  return { lines: priced, total: priced.reduce((sum, line) => sum + line.lineTotal, 0) };
}

// Input checks for the basket actions. The browser sends text, so a quantity
// must be plain digits: empty, decimals, signs and exponents are refused.
export const basketIdSchema = z.string().min(1).max(100);

const qtyInputSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(MIN_LINE_QTY).max(MAX_LINE_QTY));

export function parseQtyInput(value: unknown): number | null {
  const parsed = qtyInputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
