import { err, ok, type Result } from "./result";

// What a Checkout session carries so the webhook can rebuild the order: the
// shop, and each line's product, quantity and the unit price (cents) the
// customer was charged. Stripe limits a metadata value to 500 characters, so
// the lines are split over `lines`, `lines_1`, `lines_2`, ... The `app`
// marker lets the webhook ignore sessions this app did not create.
export const ORDER_APP = "sellify-stores";

export type OrderLine = { productId: string; qty: number; unitPrice: number };

const CHUNK = 450;
const MAX_CHUNKS = 40;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export function encodeOrderMetadata(shopId: string, lines: OrderLine[]): Record<string, string> {
  const text = lines.map((l) => `${l.productId}:${l.qty}:${l.unitPrice}`).join("|");
  if (Math.ceil(text.length / CHUNK) > MAX_CHUNKS) throw new Error("The order is too large to send to Stripe.");
  const meta: Record<string, string> = { app: ORDER_APP, shopId };
  for (let i = 0, n = 0; i < text.length; i += CHUNK, n++) {
    meta[n === 0 ? "lines" : `lines_${n}`] = text.slice(i, i + CHUNK);
  }
  return meta;
}

export function decodeOrderMetadata(
  meta: Record<string, string | undefined>,
): Result<{ shopId: string; lines: OrderLine[] }, string> {
  if (meta.app !== ORDER_APP) return err("Not an order created by this app.");
  if (!meta.shopId) return err("The order has no shop.");
  let text = meta.lines ?? "";
  for (let n = 1; n < MAX_CHUNKS && meta[`lines_${n}`] !== undefined; n++) text += meta[`lines_${n}`];
  if (!text) return err("The order has no lines.");

  const seen = new Set<string>();
  const lines: OrderLine[] = [];
  for (const part of text.split("|")) {
    const [productId, qty, unitPrice, ...rest] = part.split(":");
    if (rest.length > 0 || !productId || !ID_PATTERN.test(productId) || seen.has(productId)) {
      return err("The order lines are malformed.");
    }
    if (!/^[1-9]\d{0,2}$/.test(qty ?? "") || !/^\d{1,9}$/.test(unitPrice ?? "")) {
      return err("The order lines are malformed.");
    }
    seen.add(productId);
    lines.push({ productId, qty: Number(qty), unitPrice: Number(unitPrice) });
  }
  return ok({ shopId: meta.shopId, lines });
}
