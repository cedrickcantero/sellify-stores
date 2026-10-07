import "server-only";
import { auth } from "./server";

// Removes Better Auth's session cookies from the current Next.js response.
// Does nothing outside a request (for example in tests or scripts).
export async function clearSessionCookies(): Promise<void> {
  let store: Awaited<ReturnType<typeof import("next/headers").cookies>>;
  try {
    const { cookies } = await import("next/headers");
    store = await cookies();
  } catch {
    return;
  }
  const { authCookies } = await auth.$context;
  for (const cookie of [
    authCookies.sessionToken,
    authCookies.sessionData,
    authCookies.dontRememberToken,
    authCookies.accountData,
  ]) {
    try {
      store.delete(cookie.name);
    } catch {
      // Cookies are read-only while rendering a Server Component.
    }
  }
}
