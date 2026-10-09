import { describe, expect, it } from "vitest";
import { decodeOrderMetadata, encodeOrderMetadata, ORDER_APP } from "./order-metadata";

const line = (n: number) => ({ productId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, qty: 2, unitPrice: 19900 });

describe("order metadata", () => {
  it("round-trips the shop and lines and marks the session as ours", () => {
    const lines = [line(1), line(2)];
    const meta = encodeOrderMetadata("shop-1", lines);
    expect(meta.app).toBe(ORDER_APP);
    expect(decodeOrderMetadata(meta)).toEqual({ ok: true, value: { shopId: "shop-1", lines } });
  });

  it("keeps every value under Stripe's 500 character limit for a full basket", () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({
      productId: `p${i}-${"x".repeat(90)}`,
      qty: 99,
      unitPrice: 123456789,
    }));
    const meta = encodeOrderMetadata("shop-1", lines);
    expect(Object.keys(meta).length).toBeLessThanOrEqual(50);
    for (const value of Object.values(meta)) expect(value.length).toBeLessThanOrEqual(500);
    expect(decodeOrderMetadata(meta)).toEqual({ ok: true, value: { shopId: "shop-1", lines } });
  });

  it("refuses metadata that was not created by this app", () => {
    expect(decodeOrderMetadata({}).ok).toBe(false);
    expect(decodeOrderMetadata({ shopId: "s", lines: "p:1:100" }).ok).toBe(false);
  });

  it.each([
    ["no lines", ""],
    ["a missing quantity", "p1"],
    ["a zero quantity", "p1:0:100"],
    ["a fractional price", "p1:1:10.5"],
    ["a negative price", "p1:1:-5"],
    ["a repeated product", "p1:1:100|p1:2:100"],
  ])("refuses %s", (_name, lines) => {
    expect(decodeOrderMetadata({ app: ORDER_APP, shopId: "s", lines }).ok).toBe(false);
  });

  it("refuses a missing shop id", () => {
    expect(decodeOrderMetadata({ app: ORDER_APP, lines: "p1:1:100" }).ok).toBe(false);
  });
});
