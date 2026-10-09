import { describe, expect, it } from "vitest";
import { mergePosLines } from "./pos";

describe("mergePosLines", () => {
  it("keeps distinct lines in order", () => {
    expect(
      mergePosLines([
        { productId: "a", qty: 1 },
        { productId: "b", qty: 3 },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { productId: "a", qty: 1 },
        { productId: "b", qty: 3 },
      ],
    });
  });

  it("merges duplicate lines for the same product", () => {
    expect(
      mergePosLines([
        { productId: "a", qty: 1 },
        { productId: "b", qty: 1 },
        { productId: "a", qty: 2 },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { productId: "a", qty: 3 },
        { productId: "b", qty: 1 },
      ],
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001])(
    "rejects quantity %s",
    (qty) => {
      expect(mergePosLines([{ productId: "a", qty }]).ok).toBe(false);
    },
  );

  it("rejects an empty sale and a missing product id", () => {
    expect(mergePosLines([]).ok).toBe(false);
    expect(mergePosLines([{ productId: "", qty: 1 }]).ok).toBe(false);
  });
});
