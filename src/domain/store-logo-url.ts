import { isShopImageUrl } from "./shop-image-url";

// What uploadImage stores a logo as: <uuid>.<ext>, SVG allowed (it is
// sanitised on upload and only rendered through <img>).
const LOGO_FILE_PATTERN = /^[A-Za-z0-9-]+\.(png|jpg|gif|webp|svg)$/i;

// True only for an https URL on this project's Blob store host, directly
// under images/<shopId>/, naming an uploaded logo. A store's logoUrl must
// pass this for its own shop, so a store can never point at another host
// or another shop's files.
export function isShopLogoUrl(value: string, shopId: string, blobHost: string | null): boolean {
  return isShopImageUrl(value, shopId, blobHost, LOGO_FILE_PATTERN);
}
