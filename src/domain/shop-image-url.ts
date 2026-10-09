const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const PHOTO_FILE = /^[A-Za-z0-9._-]+\.(png|jpg|jpeg|gif|webp)$/i;

// True only for a Vercel Blob URL that sits directly under images/<shopId>/
// and names a raster image. Product photo URLs come back from the browser,
// so a product only ever stores URLs that pass this check for its own shop.
// SVG is not a product photo.
export function isShopImageUrl(value: string, shopId: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  if (!url.hostname.endsWith(BLOB_HOST_SUFFIX) || url.hostname === BLOB_HOST_SUFFIX.slice(1)) {
    return false;
  }
  if (url.search || url.hash) return false;

  const prefix = `/images/${shopId}/`;
  if (!url.pathname.startsWith(prefix)) return false;
  const file = url.pathname.slice(prefix.length);
  // No nested folders, dot segments or encoded tricks: one plain file name.
  return PHOTO_FILE.test(file) && !file.includes("..");
}
