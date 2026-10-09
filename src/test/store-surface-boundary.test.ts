import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Proves the lint rule that keeps the Sellify ui out of the store surface,
// while the database boundary still applies there.
const eslint = new ESLint();

async function restrictedImportErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports").map((m) => m.message);
}

describe("store surface boundary", () => {
  it("fails when a store page imports the Sellify ui", async () => {
    const errors = await restrictedImportErrors(
      'import { Button } from "@/ui";\nexport const x = Button;\n',
      "src/app/(store)/s/[slug]/page.tsx",
    );
    expect(errors).toHaveLength(1);
  });

  it("fails when a store-ui component imports a ui file", async () => {
    const errors = await restrictedImportErrors(
      'import { Button } from "@/ui/button";\nexport const x = Button;\n',
      "src/store-ui/example.tsx",
    );
    expect(errors).toHaveLength(1);
  });

  it("still keeps the database client out of store pages", async () => {
    const errors = await restrictedImportErrors(
      'import { db } from "@/data/db";\nexport const x = db;\n',
      "src/app/(store)/s/[slug]/page.tsx",
    );
    expect(errors).toHaveLength(1);
  });

  it("allows store-ui in store pages and the ui in backend pages", async () => {
    expect(
      await restrictedImportErrors(
        'import { StoreShell } from "@/store-ui";\nexport const x = StoreShell;\n',
        "src/app/(store)/s/[slug]/page.tsx",
      ),
    ).toEqual([]);
    expect(
      await restrictedImportErrors(
        'import { Button } from "@/ui";\nexport const x = Button;\n',
        "src/app/(backend)/online-store/page.tsx",
      ),
    ).toEqual([]);
  });
});
