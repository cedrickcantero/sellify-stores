import { describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./test-database-url";

describe("testDatabaseUrl", () => {
  it("returns TEST_DATABASE_URL when it is set and differs from DATABASE_URL", () => {
    expect(
      testDatabaseUrl({ DATABASE_URL: "postgres://main", TEST_DATABASE_URL: "postgres://test" }),
    ).toBe("postgres://test");
  });

  it("refuses to run when TEST_DATABASE_URL is missing", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: "postgres://main" })).toThrow(/TEST_DATABASE_URL/);
  });

  it("refuses to run when TEST_DATABASE_URL is the same database as DATABASE_URL", () => {
    expect(() =>
      testDatabaseUrl({ DATABASE_URL: "postgres://same", TEST_DATABASE_URL: "postgres://same" }),
    ).toThrow(/differ/);
  });
});
