// Internal store links, kept apart from the shell so server code can use
// them without loading the store's fonts. In a preview they keep ?preview so
// the next page is also asked for as a preview; the server alone decides
// whether that shows the draft (members only), so the flag grants nothing.
// `query` is extra query text such as "stock=changed".
export function storeHref(basePath: string, path: string, preview = false, query?: string): string {
  const href = `${basePath}${path}` || "/";
  const parts = [...(preview ? ["preview"] : []), ...(query ? [query] : [])];
  return parts.length > 0 ? `${href}?${parts.join("&")}` : href;
}
