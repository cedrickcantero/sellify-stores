import { PHOTO_FILE_PATTERN } from "./product-photo";

const TOKEN_STORE_ID = /^vercel_blob_rw_([A-Za-z0-9]+)_/;

// The public host of the Blob store a read-write token belongs to, for
// example "abc123.public.blob.vercel-storage.com". Null when the token is
// missing or not in the vercel_blob_rw_<storeId>_<secret> format.
export function blobHostForToken(token: string | undefined): string | null {
  const storeId = token ? TOKEN_STORE_ID.exec(token)?.[1] : undefined;
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

// True only for an https URL on this app's own Blob store host, directly
// under images/<shopId>/, naming a raster image. Product photo URLs come
// back from the browser, so a product only ever stores URLs that pass this
// check for its own shop. With no known host nothing is accepted. SVG is not
// a product photo.
export function isShopImageUrl(value: string, shopId: string, blobHost: string | null): boolean {
  if (!blobHost) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  if (url.hostname !== blobHost.toLowerCase()) return false;
  if (url.search || url.hash) return false;

  const prefix = `/images/${shopId}/`;
  if (!url.pathname.startsWith(prefix)) return false;
  const file = url.pathname.slice(prefix.length);
  // No nested folders, dot segments or encoded tricks: one plain file name.
  return PHOTO_FILE_PATTERN.test(file) && !file.includes("..");
}
