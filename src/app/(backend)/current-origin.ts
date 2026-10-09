import { headers } from "next/headers";

// The origin this request was made to, for building links a person can open
// (the store address, the preview link). Server code only.
export async function currentOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? "http";
  return `${proto}://${h.get("host") ?? "localhost:3000"}`;
}
