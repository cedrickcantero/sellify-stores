import { describe, expect, it } from "vitest";
import { isReservedSlug, slugCandidates, slugify } from "./slug";

describe("reserved slugs", () => {
  it.each(["www", "app", "api", "admin", "mail", "s", "_host"])("never offers %s to a shop", (reserved) => {
    expect(isReservedSlug(reserved)).toBe(true);
    expect(slugCandidates(reserved).next().value).toBe(`${reserved}-2`);
  });

  it("offers an ordinary slug as it is", () => {
    expect(isReservedSlug("fixit-galway")).toBe(false);
    expect(slugCandidates("apps").next().value).toBe("apps");
  });
});

describe("slugify", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(slugify("FixIt Galway")).toBe("fixit-galway");
  });

  it("drops accents and punctuation", () => {
    expect(slugify("  Café Phones & Repairs!  ")).toBe("cafe-phones-repairs");
  });

  it("falls back to 'shop' when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("shop");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = slugify("a".repeat(30) + " " + "b".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("slugCandidates", () => {
  it("yields the base slug, then numbered variants", () => {
    const candidates = slugCandidates("fixit-galway");
    expect([candidates.next().value, candidates.next().value, candidates.next().value]).toEqual([
      "fixit-galway",
      "fixit-galway-2",
      "fixit-galway-3",
    ]);
  });
});
