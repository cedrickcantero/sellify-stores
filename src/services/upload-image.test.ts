import { beforeEach, describe, expect, it, vi } from "vitest";

// Vercel Blob is the system boundary; replace it with a fake store.
const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put }));

const { uploadImage, MAX_IMAGE_BYTES } = await import("./upload-image");

const SHOP_ID = "shop-123";
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];

function fileOf(bytes: number[], size: number, name: string, type: string): File {
  const data = new Uint8Array(size);
  data.set(bytes);
  return new File([data], name, { type });
}

beforeEach(() => {
  put.mockReset();
  put.mockImplementation(async (pathname: string) => ({
    url: `https://blob.example.com/${pathname}`,
  }));
});

describe("uploadImage", () => {
  it("stores a PNG and returns its public URL", async () => {
    const result = await uploadImage(SHOP_ID, fileOf(PNG_HEADER, 1024, "logo.png", "image/png"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.url).toMatch(/^https:\/\/blob\.example\.com\/images\/shop-123\/[0-9a-f-]{36}\.png$/);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("stores a JPEG", async () => {
    const result = await uploadImage(SHOP_ID, fileOf(JPEG_HEADER, 2048, "phone.jpg", "image/jpeg"));
    expect(result.ok).toBe(true);
  });

  it("stores an SVG logo", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const result = await uploadImage(SHOP_ID, new File([svg], "wordmark.svg", { type: "image/svg+xml" }));
    expect(result.ok).toBe(true);
  });

  it("stores an SVG logo only after removing script from it", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect width="4"/></svg>';
    const result = await uploadImage(SHOP_ID, new File([svg], "logo.svg", { type: "image/svg+xml" }));

    expect(result.ok).toBe(true);
    const [, body, options] = put.mock.calls[0];
    expect(String(body)).toBe('<svg xmlns="http://www.w3.org/2000/svg"><rect width="4"/></svg>');
    expect(options).toMatchObject({ contentType: "image/svg+xml" });
  });

  it("accepts a file of exactly 2 MB", async () => {
    const result = await uploadImage(SHOP_ID, fileOf(PNG_HEADER, MAX_IMAGE_BYTES, "big.png", "image/png"));
    expect(result.ok).toBe(true);
  });

  it("rejects a file over 2 MB without storing it", async () => {
    const result = await uploadImage(SHOP_ID, 
      fileOf(PNG_HEADER, 2 * 1024 * 1024 + 1, "huge.png", "image/png"),
    );

    expect(result).toEqual({ ok: false, error: "too_large" });
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a file that is not an image without storing it", async () => {
    const result = await uploadImage(SHOP_ID, 
      new File(["%PDF-1.7 not an image"], "invoice.pdf", { type: "application/pdf" }),
    );

    expect(result).toEqual({ ok: false, error: "bad_type" });
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a non-image renamed and labelled as an image", async () => {
    const result = await uploadImage(SHOP_ID, 
      new File(["<html><script>alert(1)</script></html>"], "fake.png", { type: "image/png" }),
    );

    expect(result).toEqual({ ok: false, error: "bad_type" });
    expect(put).not.toHaveBeenCalled();
  });
});
