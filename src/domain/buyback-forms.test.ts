import { describe, expect, it } from "vitest";
import { MAX_EUROS_MESSAGE, parseBasePriceForm, parseDeductionsForm, parseQuoteId } from "./buyback-forms";

describe("parseBasePriceForm", () => {
  const valid = { deviceModelId: "apple-iphone-13", storage: "128GB", basePrice: "250.50" };

  it("returns the values with the price in cents", () => {
    expect(parseBasePriceForm(valid)).toEqual({
      ok: true,
      value: { deviceModelId: "apple-iphone-13", storage: "128GB", basePrice: 25050 },
    });
  });

  it("says what to fix for each field", () => {
    const result = parseBasePriceForm({ deviceModelId: "", storage: "", basePrice: "abc" });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.fieldErrors).toEqual({
        deviceModelId: "Choose a model.",
        storage: "Choose a storage size.",
        basePrice: "Enter a price above 0.",
      });
    }
  });

  it("rejects zero and amounts of 100,000 euros or more", () => {
    const zero = parseBasePriceForm({ ...valid, basePrice: "0" });
    const big = parseBasePriceForm({ ...valid, basePrice: "100000.01" });
    const edge = parseBasePriceForm({ ...valid, basePrice: "100000" });
    expect(zero.ok ? null : zero.fieldErrors.basePrice).toBe("Enter a price above 0.");
    expect(big.ok ? null : big.fieldErrors.basePrice).toBe(MAX_EUROS_MESSAGE);
    expect(edge.ok).toBe(true);
    expect(MAX_EUROS_MESSAGE).toBe("Enter an amount below €100,000.");
  });
});

describe("parseDeductionsForm", () => {
  function form(overrides: Record<string, string> = {}) {
    return {
      "screen_cracked-yes-kind": "amount",
      "screen_cracked-yes-value": "50",
      "powers_on-no-kind": "floor",
      "powers_on-no-value": "20.50",
      ...overrides,
    };
  }

  it("keeps only the rules that are set, in cents", () => {
    expect(parseDeductionsForm(form())).toEqual({
      ok: true,
      value: [
        { questionKey: "screen_cracked", answer: true, kind: "amount", value: 5000 },
        { questionKey: "powers_on", answer: false, kind: "floor", value: 2050 },
      ],
    });
  });

  it("allows a zero amount but reports bad and oversized amounts per row", () => {
    const zero = parseDeductionsForm(form({ "screen_cracked-yes-value": "0" }));
    expect(zero.ok).toBe(true);

    const bad = parseDeductionsForm(
      form({ "screen_cracked-yes-value": "x", "powers_on-no-value": "100000.01" }),
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.fieldErrors["screen_cracked-yes"]).toBe("Enter an amount, for example 25 or 12.50.");
      expect(bad.fieldErrors["powers_on-no"]).toBe(MAX_EUROS_MESSAGE);
    }
  });

  it("rejects an unknown rule kind", () => {
    const result = parseDeductionsForm(form({ "battery_ok-no-kind": "bonus" }));
    expect(result.ok).toBe(false);
  });
});

describe("parseQuoteId", () => {
  it("accepts a non-empty id and rejects the rest", () => {
    expect(parseQuoteId("abc")).toBe("abc");
    expect(parseQuoteId("")).toBeNull();
    expect(parseQuoteId(null)).toBeNull();
    expect(parseQuoteId("x".repeat(100))).toBeNull();
  });
});
