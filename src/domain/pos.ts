import { err, ok, type Result } from "./result";

export type PosLine = { productId: string; qty: number };

/** No real shop sells more than this of one product in one sale. */
export const MAX_LINE_QTY = 1_000_000;

// Checks the lines of a POS sale and merges repeated products into one line,
// keeping the order of first appearance. The error is a message for the owner.
export function mergePosLines(lines: PosLine[]): Result<PosLine[], string> {
  if (lines.length === 0) return err("Add at least one product to the sale.");
  const merged = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId) return err("A product in the sale could not be found.");
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_LINE_QTY) {
      return err("Enter a whole quantity of 1 or more.");
    }
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty);
  }
  return ok([...merged].map(([productId, qty]) => ({ productId, qty })));
}
