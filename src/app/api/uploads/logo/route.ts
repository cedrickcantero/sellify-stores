import { NextResponse } from "next/server";
import { getActiveShop } from "@/auth/session";
import { uploadLogoFromRequest } from "@/services/upload-logo";

// Uploads a store logo for the signed-in owner's shop and returns its URL.
// The Online Store form posts the file here first, then saves only the URL
// to the draft, so server actions never carry the file (default body
// limit). Without a session getActiveShop() redirects to /login.
export async function POST(request: Request) {
  const { shopId } = await getActiveShop();
  const { status, body } = await uploadLogoFromRequest(shopId, request);
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}
