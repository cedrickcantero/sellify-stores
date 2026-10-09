import "server-only";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getActiveShop } from "@/auth/session";
import { MAX_IMAGE_BYTES } from "./upload-image";

// Product photos go from the browser straight to Vercel Blob (a server action
// body is capped well below a few photos on Vercel). The browser asks this
// route for a short-lived token; the token is limited to the shop's own
// folder, raster image types and 2 MB. SVG is not a product photo.
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const PHOTO_FILE = /^[A-Za-z0-9._-]+\.(png|jpg|jpeg|gif|webp)$/i;

export function productPhotoTokenOptions(shopId: string, pathname: string) {
  const prefix = `images/${shopId}/`;
  const file = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  if (!PHOTO_FILE.test(file) || file.includes("..")) {
    throw new Error("Photos must be PNG, JPEG, GIF or WebP files in your shop's folder.");
  }
  return {
    allowedContentTypes: ALLOWED_TYPES,
    maximumSizeInBytes: MAX_IMAGE_BYTES,
    addRandomSuffix: true,
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
    const message = error instanceof Error ? error.message : "Could not upload that photo.";
    return { status: 400, body: { error: message } };
  }
}
