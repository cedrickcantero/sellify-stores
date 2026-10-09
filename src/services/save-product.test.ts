import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductInput } from "@/domain/product";
import { err, ok } from "@/domain/result";

// The repository and Blob upload are the system boundaries; fake both.
const repo = { get: vi.fn(), create: vi.fn(), update: vi.fn() };
const forShop = vi.fn(() => ({ products: repo }));
vi.mock("@/data", () => ({ forShop }));
const uploadImage = vi.fn();
vi.mock("./upload-image", () => ({ uploadImage }));

const { saveProduct } = await import("./save-product");

const values = {
  title: "iPhone 13",
  kind: "phone",
  condition: "good",
  price: "349.00",
  stockQty: "2",
  deviceModelId: "",
};

const png = new File([new Uint8Array(8)], "front.png", { type: "image/png" });

beforeEach(() => {
  vi.resetAllMocks();
  forShop.mockImplementation(() => ({ products: repo }));
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  repo.create.mockImplementation(async (input: ProductInput) => ({ id: "p1", shopId: "s1", ...input }));
  repo.update.mockImplementation(async (id: string, input: ProductInput) => ({ id, shopId: "s1", ...input }));
});

describe("saveProduct", () => {
  it("creates a product for the given shop and uploads new photos through uploadImage", async () => {
    uploadImage.mockResolvedValue(ok({ url: "https://blob.example.com/front.png" }));

    const result = await saveProduct("s1", { values, keptImages: [], files: [png] });

    expect(uploadImage).toHaveBeenCalledWith("s1", png);
    expect(forShop).toHaveBeenCalledWith("s1");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: 34900, stockQty: 2, images: ["https://blob.example.com/front.png"] }),
    );
    expect(result.ok).toBe(true);
  });

  it("returns field errors and saves nothing when the form is invalid", async () => {
    const result = await saveProduct("s1", {
      values: { ...values, price: "0", title: "" },
      keptImages: [],
      files: [png],
    });

    expect(result).toEqual({
      ok: false,
      error: { fields: { title: "Enter a title.", price: "Enter a price above 0." } },
    });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("explains a too-large or wrong-type photo and saves nothing", async () => {
    uploadImage.mockResolvedValueOnce(err("too_large"));
    const tooLarge = await saveProduct("s1", { values, keptImages: [], files: [png] });
    expect(tooLarge).toEqual({
      ok: false,
      error: { fields: { images: "front.png is over 2 MB. Choose a smaller photo." } },
    });

    uploadImage.mockResolvedValueOnce(err("bad_type"));
    const badType = await saveProduct("s1", { values, keptImages: [], files: [png] });
    expect(badType).toEqual({
      ok: false,
      error: { fields: { images: "front.png is not a photo. Use a PNG, JPEG, GIF, WebP or SVG." } },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("shows a friendly error when photo upload is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const result = await saveProduct("s1", { values, keptImages: [], files: [png] });

    expect(result).toEqual({
      ok: false,
      error: {
        fields: { images: "Photo upload is not set up yet. Save without photos, or connect Blob storage." },
      },
    });
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("shows a friendly error when the upload itself fails", async () => {
    uploadImage.mockRejectedValue(new Error("network"));

    const result = await saveProduct("s1", { values, keptImages: [], files: [png] });

    expect(result).toEqual({
      ok: false,
      error: { fields: { images: "We could not upload front.png. Try again." } },
    });
  });

  it("ignores empty file inputs and does not need Blob without photos", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const empty = new File([], "", { type: "application/octet-stream" });

    const result = await saveProduct("s1", { values, keptImages: [], files: [empty] });

    expect(result.ok).toBe(true);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("on edit keeps only photos the product already has, then adds new ones", async () => {
    repo.get.mockResolvedValue({ id: "p1", shopId: "s1", images: ["https://blob/a.png", "https://blob/b.png"] });
    uploadImage.mockResolvedValue(ok({ url: "https://blob/new.png" }));

    await saveProduct("s1", {
      id: "p1",
      values,
      keptImages: ["https://blob/b.png", "https://evil.example.com/x.png"],
      files: [png],
    });

    expect(repo.update).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ images: ["https://blob/b.png", "https://blob/new.png"] }),
    );
  });

  it("reports a product that no longer exists", async () => {
    repo.get.mockResolvedValue(null);

    const result = await saveProduct("s1", { id: "gone", values, keptImages: [], files: [] });

    expect(result).toEqual({ ok: false, error: { form: "That product no longer exists." } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("counts new photos against the 8 photo limit before uploading", async () => {
    const kept = Array.from({ length: 8 }, (_, i) => `https://blob/${i}.png`);
    repo.get.mockResolvedValue({ id: "p1", shopId: "s1", images: kept });

    const result = await saveProduct("s1", { id: "p1", values, keptImages: kept, files: [png] });

    expect(result).toEqual({ ok: false, error: { fields: { images: "Add up to 8 photos." } } });
    expect(uploadImage).not.toHaveBeenCalled();
  });
});
