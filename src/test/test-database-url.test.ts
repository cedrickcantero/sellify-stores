import { describe, expect, it } from "vitest";
import { databaseKey, testDatabaseUrl } from "./test-database-url";

const MAIN = "postgresql://user:pw@ep-cool-123.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const MAIN_POOLED =
  "postgresql://other:pw2@ep-cool-123-pooler.eu-west-2.aws.neon.tech:5432/neondb?sslmode=require&channel_binding=require";
const TEST_BRANCH = "postgresql://user:pw@ep-test-456.eu-west-2.aws.neon.tech/neondb?sslmode=require";

describe("databaseKey", () => {
  it("treats the pooled and direct Neon hosts, default port and credentials as one database", () => {
    expect(databaseKey(MAIN_POOLED)).toBe(databaseKey(MAIN));
  });

  it("tells different hosts apart", () => {
    expect(databaseKey(TEST_BRANCH)).not.toBe(databaseKey(MAIN));
  });

  it("tells different database names on one host apart", () => {
    expect(databaseKey("postgres://localhost:5432/app_test")).not.toBe(
      databaseKey("postgres://localhost/app"),
    );
  });

  it("ignores host case", () => {
    expect(databaseKey("postgres://LOCALHOST/app")).toBe(databaseKey("postgres://localhost:5432/app"));
  });
});

describe("testDatabaseUrl", () => {
  it("returns TEST_DATABASE_URL when it points at a different database", () => {
    expect(testDatabaseUrl({ DATABASE_URL: MAIN, TEST_DATABASE_URL: TEST_BRANCH })).toBe(TEST_BRANCH);
  });

  it("refuses to run when TEST_DATABASE_URL is missing", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: MAIN })).toThrow(/TEST_DATABASE_URL is not set/);
  });

  it("refuses to run when TEST_DATABASE_URL is the same string as DATABASE_URL", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: MAIN, TEST_DATABASE_URL: MAIN })).toThrow(/differ/);
  });

  it("refuses to run when TEST_DATABASE_URL is the same database written differently", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: MAIN, TEST_DATABASE_URL: MAIN_POOLED })).toThrow(
      /differ/,
    );
  });

  it("refuses to run when TEST_DATABASE_URL is not a valid URL", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: MAIN, TEST_DATABASE_URL: "not a url" })).toThrow(
      /valid/,
    );
  });
});
