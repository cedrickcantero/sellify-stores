import "server-only";
import { decrementStock, forShop, inTransaction, type SaleItem } from "@/data";
import { mergePosLines, type PosLine } from "@/domain/pos";
import { err, ok, type Result } from "@/domain/result";

// Thrown inside the transaction to roll back the lines already taken.
class OutOfStock extends Error {
  constructor(readonly productIds: string[]) {
    super("Out of stock");
  }
}

// Rings up an in-shop sale in one transaction. Quantities are checked, repeated
// products are merged, and prices come from the database (the caller sends only
// product ids and quantities). If any line is out of stock, nothing changes and
// the ids of the short products come back. `invalid` is a message for the owner
// when the lines themselves are wrong.
export async function recordPosSale(
  shopId: string,
  lines: PosLine[],
): Promise<Result<{ saleId: string }, { outOfStock: string[]; invalid?: string }>> {
  const merged = mergePosLines(lines);
  if (!merged.ok) return err({ outOfStock: [], invalid: merged.error });
  const sales = forShop(shopId).sales;

  try {
    const saleId = await inTransaction(async (tx) => {
      const products = new Map(
        (
          await sales.lockProducts(
            tx,
            merged.value.map((l) => l.productId),
          )
        ).map((p) => [p.id, p]),
      );
      const short: string[] = [];
      const items: SaleItem[] = [];
      for (const line of merged.value) {
        const found = products.get(line.productId);
        if (!found || !(await decrementStock(tx, shopId, line.productId, line.qty))) {
          short.push(line.productId);
          continue;
        }
        items.push({
          productId: found.id,
          title: found.title,
          quantity: line.qty,
          unitPrice: found.price,
        });
      }
      if (short.length > 0) throw new OutOfStock(short);
      return (await sales.createPos(tx, items)).saleId;
    });
    return ok({ saleId });
  } catch (error) {
    if (error instanceof OutOfStock) return err({ outOfStock: error.productIds });
    throw error;
  }
}
