import { NextResponse, type NextRequest } from "next/server";
import { classifyRequest, hostEnv, pathSlug, PREVIEW_HEADER, STORE_HOST_SEGMENT } from "@/domain/store-host";

// Host to path routing only; no database access here. Store pages live
// under /s/[slug]. A request on a store host (a subdomain of
// STORE_ROOT_DOMAIN or a custom domain) is rewritten to /s/_host/<path>,
// and the store layout then resolves the shop from the real host with
// resolveStore(). The app host (APP_HOST, localhost and *.vercel.app
// previews) and /s/<slug> paths pass through unchanged. The shop is always
// resolved server-side from the host and path, never from anything else
// the browser sends.
export function proxy(request: NextRequest): NextResponse {
  const host = request.headers.get("host") ?? "";
  const { pathname, searchParams } = request.nextUrl;
  const target = classifyRequest(host, pathname, hostEnv());

  // Store layouts cannot read search params, so the preview flag travels as
  // a request header (any copy the browser sent is replaced). The header
  // only asks for a preview and grants nothing: the guard is the membership
  // check in getStorefront, which shows the draft only to a member of the
  // shop signed in on this request.
  const preview = target.kind !== "app" && searchParams.has("preview");
  const headers = new Headers(request.headers);
  headers.delete(PREVIEW_HEADER);
  if (preview) headers.set(PREVIEW_HEADER, "1");

  let response: NextResponse;
  if ((target.kind === "subdomain" || target.kind === "domain") && pathSlug(pathname) !== STORE_HOST_SEGMENT) {
    const url = request.nextUrl.clone();
    url.pathname = `/s/${STORE_HOST_SEGMENT}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers } });
  } else {
    response = NextResponse.next({ request: { headers } });
  }

  // A preview may render the owner's draft; it must never be cached.
  if (preview) response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = {
  // Everything except the API, Next.js internals and files with an extension.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
