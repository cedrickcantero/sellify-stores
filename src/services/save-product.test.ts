import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductInput } from "@/domain/product";

// The repository and device catalog are the system boundary; fake them.
const repo = { create: vi.fn(), update: vi.fn() };
const forShop = vi.fn(() => ({ products: repo }));
const deviceCatalog = { list: vi.fn() };
vi.mock("@/data", () => ({ forShop, deviceCatalog }));

const { saveProduct } = await import("./save-product");

const values = {
  title: "iPhone 13",
  kind: "phone",
  condition: "good",
  price: "349.00",
  stockQty: "2",
  deviceModelId: "",
};

const own = "https://abc.public.blob.vercel-storage.com/images/s1/front-x1.png";
const other = "https://abc.public.blob.vercel-storage.com/images/s2/front-x1.png";

beforeEach(() => {
  vi.resetAllMocks();
  forShop.mockImplementation(() => ({ products: repo }));
  deviceCatalog.list.mockResolvedValue([{ id: "apple-iphone-13" }]);
  repo.create.mockImplementation(async (input: ProductInput) => ({ id: "p1", shopId: "s1", ...input }));
  repo.update.mockImplementation(async (id: string, input: ProductInput) => ({
    ok: true,
    product: { id, shopId: "s1", ...input },
  }));
});

describe("saveProduct", () => {
  it("creates a product for the given shop with its photo URLs", async () => {
    const result = await saveProduct("s1", { values, imageUrls: [own] });

    expect(forShop).toHaveBeenCalledWith("s1");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: 34900, stockQty: 2, images: [own] }),
    );
    expect(result.ok).toBe(true);
  });

  it("returns field errors and saves nothing when the form is invalid", async () => {
    const result = await saveProduct("s1", {
      values: { ...values, price: "0", title: "" },
      imageUrls: [],
    });

    expect(result).toEqual({
      ok: false,
      error: { fields: { title: "Enter a title.", price: "Enter a price above 0." } },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejects a photo URL that is not a Blob URL under this shop's folder", async () => {
    for (const url of [other, "https://evil.example.com/images/s1/a.png", "javascript:alert(1)"]) {
      const result = await saveProduct("s1", { values, imageUrls: [own, url] });
      expect(result).toEqual({
        ok: false,
        error: { fields: { images: "One photo link is not valid. Add that photo again." } },
      });
    }
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("limits a product to 8 photos", async () => {
    const urls = Array.from(
      { length: 9 },
      (_, i) => `https://abc.public.blob.vercel-storage.com/images/s1/p${i}.png`,
    );

    const result = await saveProduct("s1", { values, imageUrls: urls });

    expect(result).toEqual({ ok: false, error: { fields: { images: "Add up to 8 photos." } } });
  });

  it("requires a device model that exists in the catalog", async () => {
    const bad = await saveProduct("s1", {
      values: { ...values, deviceModelId: "no-such-model" },
      imageUrls: [],
    });
    expect(bad).toEqual({
      ok: false,
      error: { fields: { deviceModelId: "Choose a device model from the list." } },
    });
    expect(repo.create).not.toHaveBeenCalled();

    const good = await saveProduct("s1", {
      values: { ...values, deviceModelId: "apple-iphone-13" },
      imageUrls: [],
    });
    expect(good.ok).toBe(true);
  });

  it("on edit updates only if stock is still what the form showed", async () => {
    const result = await saveProduct("s1", { id: "p1", values, imageUrls: [own], expectedStockQty: 5 });

    expect(repo.update).toHaveBeenCalledWith("p1", expect.objectContaining({ images: [own] }), 5);
    expect(result.ok).toBe(true);
  });

  it("tells the owner when stock changed since the form opened", async () => {
    repo.update.mockResolvedValue({ ok: false, reason: "stock_changed" });

    const result = await saveProduct("s1", { id: "p1", values, imageUrls: [], expectedStockQty: 5 });

    expect(result).toEqual({
      ok: false,
      error: { form: "Stock changed since you opened this. Reopen to edit." },
    });
  });

  it("reports a product that no longer exists", async () => {
    repo.update.mockResolvedValue({ ok: false, reason: "not_found" });

    const result = await saveProduct("s1", { id: "gone", values, imageUrls: [], expectedStockQty: 1 });

    expect(result).toEqual({ ok: false, error: { form: "That product no longer exists." } });
  });

  it("refuses an edit that does not say what stock the form showed", async () => {
    const result = await saveProduct("s1", { id: "p1", values, imageUrls: [] });

    expect(result.ok).toBe(false);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
