import { describe, expect, it } from "vitest";
import {
  basketIdSchema,
  cartTotals,
  clampToStock,
  MAX_CART_LINES,
  parseCart,
  parseQtyInput,
  serializeCart,
  setLineQty,
} from "./cart";

const phone = { id: "p1", price: 34950, title: "Phone" };
const case_ = { id: "p2", price: 1999, title: "Case" };

describe("cartTotals", () => {
  it("prices each line and the order from the server's prices", () => {
    const result = cartTotals(
      [
        { productId: "p1", qty: 2 },
        { productId: "p2", qty: 3 },
      ],
      [phone, case_],
    );
    expect(result.lines).toEqual([
      { product: phone, qty: 2, lineTotal: 69900 },
      { product: case_, qty: 3, lineTotal: 5997 },
    ]);
    expect(result.total).toBe(75897);
  });

  it("drops lines whose product is unknown", () => {
    const result = cartTotals(
      [
        { productId: "gone", qty: 1 },
        { productId: "p2", qty: 1 },
      ],
      [case_],
    );
    expect(result.lines.map((l) => l.product.id)).toEqual(["p2"]);
    expect(result.total).toBe(1999);
  });

  it("is an empty order for an empty basket", () => {
    expect(cartTotals([], [phone])).toEqual({ lines: [], total: 0 });
  });
});

describe("setLineQty", () => {
  const lines = [{ productId: "p1", qty: 2 }];

  it("adds a new line and changes an existing one in place", () => {
    expect(setLineQty(lines, "p2", 1, 5)).toEqual([...lines, { productId: "p2", qty: 1 }]);
    expect(setLineQty(lines, "p1", 4, 5)).toEqual([{ productId: "p1", qty: 4 }]);
  });

  it("caps the quantity at current stock and at 99", () => {
    expect(setLineQty(lines, "p1", 10, 3)).toEqual([{ productId: "p1", qty: 3 }]);
    expect(setLineQty([], "p1", 500, 1000)).toEqual([{ productId: "p1", qty: 99 }]);
  });

  it("removes the line for zero, negative or no stock", () => {
    expect(setLineQty(lines, "p1", 0, 5)).toEqual([]);
    expect(setLineQty(lines, "p1", -2, 5)).toEqual([]);
    expect(setLineQty(lines, "p1", 2, 0)).toEqual([]);
    expect(setLineQty(lines, "p1", Number.NaN, 5)).toEqual([]);
  });

  it("does not grow the basket past 20 lines", () => {
    const full = Array.from({ length: MAX_CART_LINES }, (_, i) => ({ productId: `p${i}`, qty: 1 }));
    expect(setLineQty(full, "new", 1, 5)).toEqual(full);
  });
});

describe("clampToStock", () => {
  it("caps quantities at current stock and drops sold out or unknown products", () => {
    const lines = [
      { productId: "p1", qty: 5 },
      { productId: "p2", qty: 1 },
      { productId: "p3", qty: 1 },
      { productId: "gone", qty: 1 },
    ];
    const stock = [
      { id: "p1", stockQty: 2 },
      { id: "p2", stockQty: 0 },
      { id: "p3", stockQty: 9 },
    ];
    expect(clampToStock(lines, stock)).toEqual([
      { productId: "p1", qty: 2 },
      { productId: "p3", qty: 1 },
    ]);
  });
});

describe("parseCart", () => {
  it("round-trips a basket", () => {
    const lines = [{ productId: "p1", qty: 2 }];
    expect(parseCart(serializeCart(lines))).toEqual(lines);
  });

  it("is empty for missing or unreadable values", () => {
    expect(parseCart(undefined)).toEqual([]);
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart('{"productId":"p1","qty":1}')).toEqual([]);
  });

  it("drops malformed lines and keeps the good ones", () => {
    const raw = JSON.stringify([
      { productId: "p1", qty: 1 },
      { productId: "p2", qty: 0 },
      { productId: "p3", qty: 100 },
      { productId: "p4", qty: 1.5 },
      { productId: "", qty: 1 },
      { productId: "p5", qty: 2, price: 1 },
      "x",
    ]);
    expect(parseCart(raw)).toEqual([
      { productId: "p1", qty: 1 },
      { productId: "p5", qty: 2 },
    ]);
  });

  it("merges repeated products and caps the basket at 20 lines", () => {
    const repeated = JSON.stringify([
      { productId: "p1", qty: 2 },
      { productId: "p1", qty: 3 },
    ]);
    expect(parseCart(repeated)).toEqual([{ productId: "p1", qty: 5 }]);

    const many = JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ productId: `p${i}`, qty: 1 })));
    expect(parseCart(many)).toHaveLength(MAX_CART_LINES);
  });
});

describe("basket input schemas", () => {
  it("accepts a whole quantity from 1 to 99", () => {
    expect(parseQtyInput("1")).toBe(1);
    expect(parseQtyInput("99")).toBe(99);
  });

  it.each(["", "  ", "0", "100", "-1", "2.5", "abc", "1e2", null, undefined])("rejects %j", (value) => {
    expect(parseQtyInput(value)).toBeNull();
  });

  it("accepts a slug and product id up to 100 characters and rejects empty or longer", () => {
    expect(basketIdSchema.safeParse("a".repeat(100)).success).toBe(true);
    expect(basketIdSchema.safeParse("").success).toBe(false);
    expect(basketIdSchema.safeParse("a".repeat(101)).success).toBe(false);
    expect(basketIdSchema.safeParse(5).success).toBe(false);
  });
});
