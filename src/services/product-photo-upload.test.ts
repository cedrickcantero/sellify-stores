import { beforeEach, describe, expect, it, vi } from "vitest";

// The session and Vercel Blob are the system boundaries; fake both.
const getActiveShop = vi.fn();
vi.mock("@/auth/session", () => ({ getActiveShop }));
const handleUpload = vi.fn();
vi.mock("@vercel/blob/client", () => ({ handleUpload }));

const { productPhotoTokenOptions, handleProductPhotoUpload } = await import(
  "./product-photo-upload"
);

const SHOP = "shop-1";
const body = { type: "blob.generate-client-token" } as never;

describe("productPhotoTokenOptions", () => {
  it("allows only raster images up to 2 MB under the shop's images folder", () => {
    const options = productPhotoTokenOptions(SHOP, `images/${SHOP}/front.png`);

    expect(options.allowedContentTypes).toEqual([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ]);
    expect(options.maximumSizeInBytes).toBe(2 * 1024 * 1024);
    expect(options.addRandomSuffix).toBe(true);
  });

  it("makes the token valid for five minutes", () => {
    const before = Date.now();
    const { validUntil } = productPhotoTokenOptions(SHOP, `images/${SHOP}/front.png`);

    expect(validUntil).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(validUntil).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
  });

  it.each([
    ["another shop's folder", "images/shop-2/front.png"],
    ["a prefix lookalike", "images/shop-10/front.png"],
    ["the root", "front.png"],
    ["a parent folder jump", `images/${SHOP}/../shop-2/front.png`],
    ["a nested folder", `images/${SHOP}/a/front.png`],
    ["odd characters", `images/${SHOP}/fr ont?.png`],
    ["an svg", `images/${SHOP}/logo.svg`],
    ["no file name", `images/${SHOP}/`],
  ])("rejects %s", (_name, pathname) => {
    expect(() => productPhotoTokenOptions(SHOP, pathname)).toThrow();
  });
});

describe("handleProductPhotoUpload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getActiveShop.mockResolvedValue({ shopId: SHOP });
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  });

  const request = new Request("http://localhost/api/blob/product-photo", { method: "POST" });

  it("says upload is not set up when there is no Blob token", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const result = await handleProductPhotoUpload(request, body);

    expect(result).toEqual({ status: 503, body: { error: "Photo upload is not set up yet." } });
    expect(handleUpload).not.toHaveBeenCalled();
  });

  it("takes the shop from the session and enforces the token options", async () => {
    handleUpload.mockImplementation(async ({ onBeforeGenerateToken }) => {
      const options = await onBeforeGenerateToken(`images/${SHOP}/a.png`, null, false);
      expect(options.maximumSizeInBytes).toBe(2 * 1024 * 1024);
      await expect(onBeforeGenerateToken("images/shop-2/a.png", null, false)).rejects.toThrow();
      return { type: "blob.generate-client-token", clientToken: "t" };
    });

    const result = await handleProductPhotoUpload(request, body);

    expect(result).toEqual({
      status: 200,
      body: { type: "blob.generate-client-token", clientToken: "t" },
    });
    expect(getActiveShop).toHaveBeenCalled();
  });

  it("hides unexpected errors behind a friendly message and logs the original", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = new Error("Vercel Blob: No token found");
    handleUpload.mockRejectedValue(original);

    const result = await handleProductPhotoUpload(request, body);

    expect(result).toEqual({
      status: 400,
      body: { error: "We could not upload that photo. Try again." },
    });
    expect(log).toHaveBeenCalledWith(expect.any(String), original);
    log.mockRestore();
  });

  it("passes on the plain message when a photo is refused for its path", async () => {
    handleUpload.mockImplementation(async ({ onBeforeGenerateToken }) => {
      await onBeforeGenerateToken("images/shop-2/a.png", null, false);
    });

    const result = await handleProductPhotoUpload(request, body);

    expect(result).toEqual({
      status: 400,
      body: { error: "Photos must be PNG, JPEG, GIF or WebP files in your shop's folder." },
    });
  });
});
