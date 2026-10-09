import { describe, expect, it } from "vitest";
import {
  MAX_EUROS_MESSAGE,
  parseBasePriceForm,
  parseBuybackCustomer,
  parseDeductionsForm,
  parseQuoteId,
  parseQuoteInput,
} from "./buyback-forms";

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

describe("parseQuoteInput", () => {
  const valid = {
    deviceModelId: "apple-iphone-13",
    storage: "128GB",
    answers: { screen_cracked: false, battery_ok: true, powers_on: true },
  };

  it("accepts a model, storage and the three yes/no answers", () => {
    expect(parseQuoteInput(valid)).toEqual({ ok: true, value: valid });
  });

  it("requires every question to be answered with a boolean", () => {
    const missing = parseQuoteInput({ ...valid, answers: { screen_cracked: false, battery_ok: true } });
    expect(missing.ok).toBe(false);
    const text = parseQuoteInput({ ...valid, answers: { ...valid.answers, powers_on: "yes" } });
    expect(text.ok).toBe(false);
  });

  it("requires a model and a storage size", () => {
    const result = parseQuoteInput({ ...valid, deviceModelId: "", storage: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.deviceModelId).toBe("Choose a model.");
      expect(result.fieldErrors.storage).toBe("Choose a storage size.");
    }
  });
});

describe("parseBuybackCustomer", () => {
  const valid = { name: " Niamh Walsh ", phone: "085 123 4567", email: "niamh@example.com" };

  it("trims the name and keeps valid details", () => {
    expect(parseBuybackCustomer(valid)).toEqual({
      ok: true,
      value: { name: "Niamh Walsh", phone: "085 123 4567", email: "niamh@example.com" },
    });
  });

  it("reports each invalid field", () => {
    const result = parseBuybackCustomer({ name: " ", phone: "abc", email: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "name", "phone"]);
    }
  });

  it("limits the name to 80 characters", () => {
    expect(parseBuybackCustomer({ ...valid, name: "a".repeat(81) }).ok).toBe(false);
    expect(parseBuybackCustomer({ ...valid, name: "a".repeat(80) }).ok).toBe(true);
  });
});
