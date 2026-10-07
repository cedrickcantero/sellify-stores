import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Proves the lint rule that keeps the database client inside src/data.
const eslint = new ESLint();

async function restrictedImportErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((m) => m.ruleId === "no-restricted-imports")
    .map((m) => m.message);
}

describe("database import boundary", () => {
  it("fails when a service imports the database client", async () => {
    const errors = await restrictedImportErrors(
      'import { db } from "@/data/db";\nexport const x = db;\n',
      "src/services/example.ts",
    );
    expect(errors).toHaveLength(1);
  });

  it("fails when a page imports the client by relative path", async () => {
    const errors = await restrictedImportErrors(
      'import { db } from "../../data/db";\nexport const x = db;\n',
      "src/app/dashboard/example.ts",
    );
    expect(errors).toHaveLength(1);
  });

  it("fails when code outside data uses the Neon driver directly", async () => {
    const errors = await restrictedImportErrors(
      'import { Pool } from "@neondatabase/serverless";\nexport const x = Pool;\n',
      "src/services/example.ts",
    );
    expect(errors).toHaveLength(1);
  });

  it("allows the data module to import the client", async () => {
    const errors = await restrictedImportErrors(
      'import { db } from "./db";\nexport const x = db;\n',
      "src/data/example.ts",
    );
    expect(errors).toEqual([]);
  });

  it("allows other modules to use the data module's public interface", async () => {
    const errors = await restrictedImportErrors(
      'import { forShop } from "@/data";\nexport const x = forShop;\n',
      "src/services/example.ts",
    );
    expect(errors).toEqual([]);
  });
});
