import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, PHOTO_EXTENSIONS, PHOTO_FILE_PATTERN } from "./product-photo";

describe("product photo rules", () => {
  it("limits a photo to 2 MB", () => {
    expect(MAX_PHOTO_BYTES).toBe(2 * 1024 * 1024);
  });

  it("allows only raster types, mapped to their file extension", () => {
    expect(PHOTO_EXTENSIONS).toEqual({
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
    });
  });

  it("matches one plain raster file name", () => {
    expect(PHOTO_FILE_PATTERN.test("a-b_c.1.png")).toBe(true);
    expect(PHOTO_FILE_PATTERN.test("a.jpeg")).toBe(true);
    expect(PHOTO_FILE_PATTERN.test("a.svg")).toBe(false);
    expect(PHOTO_FILE_PATTERN.test("a/b.png")).toBe(false);
    expect(PHOTO_FILE_PATTERN.test("a b.png")).toBe(false);
  });
});
