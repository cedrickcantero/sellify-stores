import { beforeEach, describe, expect, it, vi } from "vitest";

// Vercel Blob is the system boundary; replace it with a fake store.
const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put }));

const { uploadImage, MAX_IMAGE_BYTES } = await import("./upload-image");

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
    const result = await uploadImage(fileOf(PNG_HEADER, 1024, "logo.png", "image/png"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.url).toMatch(/^https:\/\/blob\.example\.com\/images\/.+\.png$/);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("stores a JPEG", async () => {
    const result = await uploadImage(fileOf(JPEG_HEADER, 2048, "phone.jpg", "image/jpeg"));
    expect(result.ok).toBe(true);
  });

  it("stores an SVG logo", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const result = await uploadImage(new File([svg], "wordmark.svg", { type: "image/svg+xml" }));
    expect(result.ok).toBe(true);
  });

  it("accepts a file of exactly 2 MB", async () => {
    const result = await uploadImage(fileOf(PNG_HEADER, MAX_IMAGE_BYTES, "big.png", "image/png"));
    expect(result.ok).toBe(true);
  });

  it("rejects a file over 2 MB without storing it", async () => {
    const result = await uploadImage(
      fileOf(PNG_HEADER, 2 * 1024 * 1024 + 1, "huge.png", "image/png"),
    );

    expect(result).toEqual({ ok: false, error: "too_large" });
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a file that is not an image without storing it", async () => {
    const result = await uploadImage(
      new File(["%PDF-1.7 not an image"], "invoice.pdf", { type: "application/pdf" }),
    );

    expect(result).toEqual({ ok: false, error: "bad_type" });
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a non-image renamed and labelled as an image", async () => {
    const result = await uploadImage(
      new File(["<html><script>alert(1)</script></html>"], "fake.png", { type: "image/png" }),
    );

    expect(result).toEqual({ ok: false, error: "bad_type" });
    expect(put).not.toHaveBeenCalled();
  });
});
