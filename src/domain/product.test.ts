import { describe, expect, it } from "vitest";
import { formatCents, parseProductForm, priceToCents, stockStatus } from "./product";

const valid = {
  title: "iPhone 13 128GB",
  kind: "phone",
  condition: "good",
  price: "349.50",
  stockQty: "3",
  deviceModelId: "",
  images: ["https://blob.example.com/a.png"],
};

describe("priceToCents", () => {
  it("converts euros to whole cents", () => {
    expect(priceToCents("349.50")).toBe(34950);
    expect(priceToCents("12")).toBe(1200);
    expect(priceToCents("0,99")).toBe(99);
    expect(priceToCents(" 1.005 ")).toBeNull();
  });

  it("rejects text, negatives and zero", () => {
    expect(priceToCents("")).toBeNull();
    expect(priceToCents("abc")).toBeNull();
    expect(priceToCents("-5")).toBeNull();
    expect(priceToCents("0")).toBeNull();
  });
});

describe("parseProductForm", () => {
  it("returns a clean product input", () => {
    const result = parseProductForm(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        title: "iPhone 13 128GB",
        kind: "phone",
        condition: "good",
        price: 34950,
        stockQty: 3,
        images: ["https://blob.example.com/a.png"],
        deviceModelId: null,
      },
    });
  });

  it("keeps a chosen device model and trims the title", () => {
    const result = parseProductForm({ ...valid, title: "  Case  ", deviceModelId: "apple-iphone-13" });
    expect(result.ok && result.value).toMatchObject({ title: "Case", deviceModelId: "apple-iphone-13" });
  });

  it("reports a field error in plain words for each bad field", () => {
    const result = parseProductForm({
      ...valid,
      title: " ",
      kind: "tablet",
      condition: "",
      price: "0",
      stockQty: "-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      title: "Enter a title.",
      kind: "Choose phone or accessory.",
      condition: "Choose a condition.",
      price: "Enter a price above 0.",
      stockQty: "Enter a whole number, 0 or more.",
    });
  });

  it("rejects fractional stock and more than 8 photos", () => {
    const result = parseProductForm({ ...valid, stockQty: "1.5", images: Array(9).fill("https://x/y.png") });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stockQty).toBeDefined();
    expect(result.error.images).toBe("Add up to 8 photos.");
  });
});

describe("stockStatus and formatCents", () => {
  it("maps stock to the status badge", () => {
    expect(stockStatus(0)).toBe("sold_out");
    expect(stockStatus(2)).toBe("in_stock");
  });

  it("formats cents as euros", () => {
    expect(formatCents(34950)).toBe("€349.50");
  });
});
