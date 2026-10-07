import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { forShop } from "@/data";
import { auth } from "./server";

// The backend's tenant: the shop of the session's active organization.
// Redirects to the login page when there is no session or no active shop.
// Backend pages and server actions take the shop id from here, never from
// the browser.
export async function getActiveShop(): Promise<{ shopId: string; userId: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const shopId = session?.session.activeOrganizationId;
  if (!session || !shopId) redirect("/login");

  const shop = await forShop(shopId).shop.get();
  if (!shop) redirect("/login");

  return { shopId: shop.id, userId: session.user.id };
}
