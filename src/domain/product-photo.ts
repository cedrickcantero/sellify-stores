// The rules for a product photo, shared by the upload route (which enforces
// them) and the product form (which checks early to give a clear message).

/** A photo can be at most 2 MB. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Allowed content types and the file extension each is stored under. Raster only: SVG is not a product photo. */
export const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** One plain file name with a raster extension, no folders or odd characters. */
export const PHOTO_FILE_PATTERN = /^[A-Za-z0-9._-]+\.(png|jpg|jpeg|gif|webp)$/i;
