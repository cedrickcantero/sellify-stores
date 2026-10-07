const MAX_SLUG_LENGTH = 48;

// A URL-safe slug for a shop name: lowercase ASCII letters, digits and single
// hyphens. Used for the store address, so it must be stable and readable.
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || "shop";
}

// The base slug first, then "<base>-2", "<base>-3" and so on, for picking the
// first one that is not taken yet.
export function* slugCandidates(base: string): Generator<string, never, unknown> {
  yield base;
  for (let n = 2; ; n++) {
    yield `${base}-${n}`;
  }
}
