import "server-only";
import { MAX_IMAGE_BYTES, uploadImage } from "./upload-image";

// Room for the multipart boundary and part headers around the file.
const MULTIPART_OVERHEAD = 64 * 1024;

const TOO_LARGE = "Choose a logo under 2 MB.";
const BAD_TYPE = "Choose a PNG, JPEG, GIF, WebP or SVG logo.";

export type LogoUploadResponse = { status: number; body: { url: string } | { error: string } };

// The body of POST /api/uploads/logo: one multipart field "logo". A declared
// Content-Length over the limit is refused before the body is read, and the
// file size is checked again after. uploadImage checks the bytes are an
// image and sanitises SVGs. shopId must come from the server session.
export async function uploadLogoFromRequest(shopId: string, request: Request): Promise<LogoUploadResponse> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD) return { status: 413, body: { error: TOO_LARGE } };

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("logo");
  } catch {
    return { status: 400, body: { error: "Choose a logo to upload." } };
  }
  if (!(file instanceof File) || file.size === 0) return { status: 400, body: { error: "Choose a logo to upload." } };
  if (file.size > MAX_IMAGE_BYTES) return { status: 413, body: { error: TOO_LARGE } };

  const uploaded = await uploadImage(shopId, file);
  if (!uploaded.ok) {
    return uploaded.error === "too_large"
      ? { status: 413, body: { error: TOO_LARGE } }
      : { status: 415, body: { error: BAD_TYPE } };
  }
  return { status: 200, body: { url: uploaded.value.url } };
}
