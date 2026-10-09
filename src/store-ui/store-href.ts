// Internal store links, kept apart from the shell so server code can use
// them without loading the store's fonts. In a preview they keep ?preview so
// the next page is also asked for as a preview; the server alone decides
// whether that shows the draft (members only), so the flag grants nothing.
export function storeHref(basePath: string, path: string, preview = false): string {
  const href = `${basePath}${path}` || "/";
  return preview ? `${href}?preview` : href;
}
