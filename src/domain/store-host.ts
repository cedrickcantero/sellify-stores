import { isReservedSlug } from "./slug";

// Which surface a request is for, decided from its host and path alone (no
// IO), so both the proxy and store resolution use the same rules:
//
// - a path /s/<slug> resolves a store by slug on any host;
// - the app host (APP_HOST, localhost, *.vercel.app previews) is the backend;
// - <slug>.<STORE_ROOT_DOMAIN> resolves a store by slug;
// - any other host is looked up as a verified custom domain.

export type HostEnv = { appHost?: string; storeRootDomain?: string };

export type RequestTarget =
  | { kind: "app" }
  | { kind: "path"; slug: string }
  | { kind: "subdomain"; slug: string }
  | { kind: "domain"; hostname: string };

// Store pages live under /s/[slug]. The proxy rewrites a request on a store
// host (subdomain or custom domain) to /s/<STORE_HOST_SEGMENT>/<path>, which
// tells store pages to resolve the shop from the host instead of the path.
// It is not a valid slug (slugs never contain "_").
export const STORE_HOST_SEGMENT = "_host";

// Request header the proxy sets on store requests that ask for a preview.
export const PREVIEW_HEADER = "x-sellify-store-preview";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function hostnameOf(host: string): string {
  const lower = host.trim().toLowerCase();
  if (lower.startsWith("[")) return lower.slice(0, lower.indexOf("]") + 1);
  return lower.split(":")[0].replace(/\.$/, "");
}

export function pathSlug(pathname: string): string | null {
  const match = /^\/s\/([^/]+)(?:\/|$)/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

export function isAppHost(host: string, env: HostEnv): boolean {
  const hostname = hostnameOf(host);
  if (LOCAL_HOSTS.has(hostname)) return true;
  if (env.appHost && hostname === hostnameOf(env.appHost)) return true;
  return hostname.endsWith(".vercel.app");
}

export function classifyRequest(host: string, pathname: string, env: HostEnv): RequestTarget {
  const slug = pathSlug(pathname);
  if (slug !== null && slug !== STORE_HOST_SEGMENT) return { kind: "path", slug };

  // The app host wins, so APP_HOST=app.sellify.ie still reaches the backend
  // when STORE_ROOT_DOMAIN=sellify.ie.
  if (isAppHost(host, env)) return { kind: "app" };

  const hostname = hostnameOf(host);
  if (env.storeRootDomain) {
    const root = hostnameOf(env.storeRootDomain);
    if (hostname.endsWith(`.${root}`)) {
      const sub = hostname.slice(0, -(root.length + 1));
      if (SLUG.test(sub) && !isReservedSlug(sub)) return { kind: "subdomain", slug: sub };
    }
  }
  return { kind: "domain", hostname };
}

// The public address of a store: its subdomain when a store root domain is
// configured, otherwise the /s/<slug> path on the app's own origin.
export function storeAddress(slug: string, opts: { storeRootDomain?: string; origin: string }): string {
  if (opts.storeRootDomain) return `https://${slug}.${hostnameOf(opts.storeRootDomain)}`;
  return `${opts.origin.replace(/\/$/, "")}/s/${slug}`;
}

export function hostEnv(): HostEnv {
  return {
    appHost: process.env.APP_HOST || undefined,
    storeRootDomain: process.env.STORE_ROOT_DOMAIN || undefined,
  };
}
