import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { activeShopForMember, type Shop } from "@/data";
import { auth } from "./server";

export type ActiveShop = { shopId: string; userId: string; shop: Shop };

// The backend's tenant: the shop of the session's active organization, and
// only while the user is still one of its members. Redirects to the login
// page otherwise. Backend pages and server actions take the shop id from
// here, never from the browser.
export async function getActiveShop(): Promise<ActiveShop> {
  const session = await auth.api.getSession({ headers: await headers() });
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) redirect("/login");

  const shop = await activeShopForMember(session.user.id, organizationId);
  if (!shop) redirect("/login");

  return { shopId: shop.id, userId: session.user.id, shop };
}
