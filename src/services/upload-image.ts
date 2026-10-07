import "server-only";
import { put } from "@vercel/blob";
import { detectImageKind } from "@/domain/image";
import { err, ok, type Result } from "@/domain/result";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const SNIFF_BYTES = 512;
const SAFE_SHOP_ID = /^[A-Za-z0-9_-]+$/;

// Stores a logo or product photo in Vercel Blob under images/<shopId>/. Only
// PNG, JPEG, GIF, WebP and SVG are accepted, identified from the file's
// bytes, and only up to 2 MB. Blob URLs are served from Vercel's storage
// domain and are only ever rendered through <img>, so an SVG cannot run
// script in the app's origin. shopId must come from the server session.
export async function uploadImage(
  shopId: string,
  file: File,
): Promise<Result<{ url: string }, "too_large" | "bad_type">> {
  if (!SAFE_SHOP_ID.test(shopId)) throw new Error("uploadImage: invalid shop id");
  if (file.size > MAX_IMAGE_BYTES) return err("too_large");

  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const kind = detectImageKind(head);
  if (!kind) return err("bad_type");

  const blob = await put(`images/${shopId}/${crypto.randomUUID()}.${kind.extension}`, file, {
    access: "public",
    contentType: kind.contentType,
  });
  return ok({ url: blob.url });
}
