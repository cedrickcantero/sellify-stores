import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Proves the lint rule that keeps raw colour values out of backend pages and
// the ui module: colours come only from the Sellify design tokens.
const eslint = new ESLint();

async function rawColourErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((m) => m.ruleId === "no-restricted-syntax")
    .map((m) => m.message);
}

const page = (body: string) => `export default function Page() {\n  return ${body};\n}\n`;
const BACKEND_PAGE = "src/app/(backend)/inventory/page.tsx";

describe("raw colour rule", () => {
  it("fails on a hex colour in a backend page", async () => {
    const errors = await rawColourErrors(page('<p style={{ color: "#9333EA" }}>Hi</p>'), BACKEND_PAGE);
    expect(errors).toHaveLength(1);
  });

  it("fails on an rgb() colour in a backend page", async () => {
    const errors = await rawColourErrors(
      page('<p style={{ color: "rgb(147, 51, 234)" }}>Hi</p>'),
      BACKEND_PAGE,
    );
    expect(errors).toHaveLength(1);
  });

  it("fails on a Tailwind palette colour class in a backend page", async () => {
    const errors = await rawColourErrors(page('<p className="mt-2 text-purple-600">Hi</p>'), BACKEND_PAGE);
    expect(errors).toHaveLength(1);
  });

  it("fails on an arbitrary Tailwind colour class in a backend page", async () => {
    const errors = await rawColourErrors(page('<p className="bg-[#FAF5FF]">Hi</p>'), BACKEND_PAGE);
    expect(errors).toHaveLength(1);
  });

  it("fails on a palette class inside a template literal", async () => {
    const errors = await rawColourErrors(
      page("<p className={`p-4 ${'x'} border-gray-200`}>Hi</p>"),
      BACKEND_PAGE,
    );
    expect(errors).toHaveLength(1);
  });

  it("fails on raw colours in the ui module and the auth pages", async () => {
    expect(
      await rawColourErrors(page('<p className="text-red-600">Hi</p>'), "src/ui/example.tsx"),
    ).toHaveLength(1);
    expect(
      await rawColourErrors(page('<p className="bg-white">Hi</p>'), "src/app/(auth)/login/page.tsx"),
    ).toHaveLength(1);
  });

  it("allows token colour classes and non-colour values", async () => {
    const errors = await rawColourErrors(
      page(
        '<p id="a1" className="bg-primary text-primary-foreground border-border text-muted-foreground shadow-card rounded-card text-page-title">Hi #1</p>',
      ),
      BACKEND_PAGE,
    );
    expect(errors).toEqual([]);
  });

  it("allows anchors that start with hex-like letters", async () => {
    const errors = await rawColourErrors(page('<a href="#add-product">Add</a>'), BACKEND_PAGE);
    expect(errors).toEqual([]);
  });

  it("does not apply outside the backend surface", async () => {
    const errors = await rawColourErrors(
      'export const primary = "#0F766E";\n',
      "src/domain/store-config.ts",
    );
    expect(errors).toEqual([]);
  });
});
