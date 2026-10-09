import { beforeEach, describe, expect, it, vi } from "vitest";

const remove = vi.fn();
vi.mock("@/data", () => ({ forShop: () => ({ products: { remove } }) }));
vi.mock("@/auth/session", () => ({ getActiveShop: async () => ({ shopId: "s1" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const saveProduct = vi.fn();
vi.mock("@/services/save-product", () => ({ saveProduct }));

const { removeProductAction, saveProductAction } = await import("./actions");

beforeEach(() => vi.resetAllMocks());

describe("removeProductAction", () => {
  it("answers a malformed id with a friendly error instead of throwing", async () => {
    const result = await removeProductAction("not-a-uuid");

    expect(result).toEqual({ error: "We could not find that product. Reload the page and try again." });
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes a product by uuid", async () => {
    remove.mockResolvedValue(true);

    expect(await removeProductAction("3f2b8c1e-5d4a-4f6b-9a1c-2e7d8b9c0a1f")).toEqual({});
    expect(remove).toHaveBeenCalledWith("3f2b8c1e-5d4a-4f6b-9a1c-2e7d8b9c0a1f");
  });
});

describe("saveProductAction", () => {
  it("passes the photo URLs and the stock the form showed to the service", async () => {
    saveProduct.mockResolvedValue({ ok: true, value: {} });
    const form = new FormData();
    form.set("title", "Case");
    form.set("id", "p1");
    form.set("expectedStockQty", "4");
    form.append("image", "https://abc.public.blob.vercel-storage.com/images/s1/a.png");

    const state = await saveProductAction({}, form);

    expect(state).toEqual({ saved: true });
    expect(saveProduct).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        id: "p1",
        expectedStockQty: 4,
        imageUrls: ["https://abc.public.blob.vercel-storage.com/images/s1/a.png"],
      }),
    );
  });
});
