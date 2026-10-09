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

describe("database import boundary", { timeout: 30_000 }, () => {
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

  it("fails when a service imports a data internal other than the index", async () => {
    const errors = await restrictedImportErrors(
      'import { shop } from "@/data/schema";\nexport const x = shop;\n',
      "src/services/example.ts",
    );
    expect(errors).toHaveLength(1);
  });

  it("fails when a service imports the maintenance helpers", async () => {
    const errors = await restrictedImportErrors(
      'import { resetTenantData } from "@/data/maintenance";\nexport const x = resetTenantData;\n',
      "src/services/example.ts",
    );
    expect(errors).toHaveLength(1);
  });

  it("allows test setup to import the maintenance helpers but not the client", async () => {
    expect(
      await restrictedImportErrors(
        'import { resetTenantData } from "@/data/maintenance";\nexport const x = resetTenantData;\n',
        "src/test/example.ts",
      ),
    ).toEqual([]);
    expect(
      await restrictedImportErrors(
        'import { db } from "@/data/db";\nexport const x = db;\n',
        "src/test/example.ts",
      ),
    ).toHaveLength(1);
  });

  it("allows scripts to import the maintenance helpers but not the client", async () => {
    expect(
      await restrictedImportErrors(
        'import { runMigrations } from "../src/data/maintenance";\nexport const x = runMigrations;\n',
        "scripts/example.ts",
      ),
    ).toEqual([]);
    expect(
      await restrictedImportErrors(
        'import { db } from "../src/data/db";\nexport const x = db;\n',
        "scripts/example.ts",
      ),
    ).toHaveLength(1);
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
