import { describe, expect, it } from "vitest";

describe("unit test environment", () => {
  it("has no database or blob credentials", () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env.TEST_DATABASE_URL).toBeUndefined();
    expect(process.env.BLOB_READ_WRITE_TOKEN).toBeUndefined();
  });
});
