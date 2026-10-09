import type { HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { handleProductPhotoUpload } from "@/services/product-photo-upload";

// Issues Vercel Blob client-upload tokens for product photos. Signed-in
// shop owners only; see handleProductPhotoUpload.
export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Could not upload that photo." }, { status: 400 });
  }
  const { status, body: response } = await handleProductPhotoUpload(request, body);
  return NextResponse.json(response, { status });
}
