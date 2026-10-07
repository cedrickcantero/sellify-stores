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
    // Delete with the same attributes the cookie was set with: a __Secure-
    // cookie is only replaced by a Secure Set-Cookie with a matching path
    // and domain.
    const { path, domain, secure, sameSite, httpOnly, partitioned } = cookie.attributes;
    try {
      store.delete({
        name: cookie.name,
        path,
        domain,
        secure,
        httpOnly,
        partitioned,
        sameSite: typeof sameSite === "string" ? (sameSite.toLowerCase() as "lax" | "strict" | "none") : undefined,
      });
    } catch {
      // Cookies are read-only while rendering a Server Component.
    }
  }
}
