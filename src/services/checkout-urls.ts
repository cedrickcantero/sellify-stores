import "server-only";
import { forShop } from "@/data";
import { classifyRequest, configuredAppOrigin, hostEnv, hostnameOf, storeAddress } from "@/domain/store-host";
import { storeHref } from "@/store-ui/store-href";

// The addresses Stripe sends the customer back to. They are built from
// configuration and the database, never copied from a request header: a
// forged Host or X-Forwarded-Proto can change which kind of address the
// request used (that only selects a branch below), but never the text of the
// addresses. Customers come back the way they arrived, because the basket
// cookie belongs to that host:
// - on <slug>.<STORE_ROOT_DOMAIN>: that subdomain, built from the slug;
// - on a verified custom domain: the hostname stored for this shop;
// - otherwise: the app's configured origin (BETTER_AUTH_URL, or APP_HOST)
//   plus /s/<slug>.
export async function checkoutReturnUrls(
  store: { shopId: string; slug: string; basePath: string },
  requestHost: string,
  preview: boolean,
): Promise<{ success: string; cancel: string }> {
  const env = hostEnv();
  const appOrigin = configuredAppOrigin({ appUrl: process.env.BETTER_AUTH_URL, appHost: env.appHost });

  let origin: string | null = null;
  let basePath = `/s/${store.slug}`;
  if (store.basePath === "") {
    const target = classifyRequest(requestHost, "/", env);
    if (target.kind === "subdomain" && env.storeRootDomain) {
      origin = storeAddress(store.slug, { storeRootDomain: env.storeRootDomain, origin: appOrigin ?? "" });
      basePath = "";
    } else if (target.kind === "domain") {
      const domain = (await forShop(store.shopId).customDomains.list()).find(
        (d) => d.status === "verified" && d.hostname === hostnameOf(requestHost),
      );
      if (domain) {
        origin = `https://${domain.hostname}`;
        basePath = "";
      }
    }
  }
  if (origin === null) {
    if (!appOrigin) throw new Error("Set BETTER_AUTH_URL or APP_HOST so checkout knows where to send customers back.");
    origin = appOrigin;
  }
  return {
    success: `${origin}${storeHref(basePath, "/checkout/success", preview)}`,
    cancel: `${origin}${storeHref(basePath, "/basket", preview)}`,
  };
}
