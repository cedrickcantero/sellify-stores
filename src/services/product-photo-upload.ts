import "server-only";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getActiveShop } from "@/auth/session";
import { MAX_PHOTO_BYTES, PHOTO_EXTENSIONS, PHOTO_FILE_PATTERN } from "@/domain/product-photo";

// Product photos go from the browser straight to Vercel Blob (a server action
// body is capped well below a few photos on Vercel). The browser asks this
// route for a short-lived token; the token is limited to the shop's own
// folder, raster image types and 2 MB. SVG is not a product photo.
const TOKEN_LIFETIME_MS = 5 * 60 * 1000;
const REFUSED = "Photos must be PNG, JPEG, GIF or WebP files in your shop's folder.";
const FAILED = "We could not upload that photo. Try again.";

// A refusal whose message is safe and useful to show the owner.
class PhotoRefused extends Error {}

export function productPhotoTokenOptions(shopId: string, pathname: string) {
  const prefix = `images/${shopId}/`;
  const file = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  if (!PHOTO_FILE_PATTERN.test(file) || file.includes("..")) throw new PhotoRefused(REFUSED);
  return {
    allowedContentTypes: Object.keys(PHOTO_EXTENSIONS),
    maximumSizeInBytes: MAX_PHOTO_BYTES,
    addRandomSuffix: true,
    validUntil: Date.now() + TOKEN_LIFETIME_MS,
  };
}

export type PhotoUploadResponse = { status: number; body: unknown };

// The route handler's logic. The shop comes from the session, never from the
// request.
export async function handleProductPhotoUpload(
  request: Request,
  body: HandleUploadBody,
): Promise<PhotoUploadResponse> {
  const { shopId } = await getActiveShop();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { status: 503, body: { error: "Photo upload is not set up yet." } };
  }
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => productPhotoTokenOptions(shopId, pathname),
    });
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof PhotoRefused) return { status: 400, body: { error: error.message } };
    console.error("Product photo upload failed.", error);
    return { status: 400, body: { error: FAILED } };
  }
}
