import "server-only";
import { activeShopForMember, forShop, resolveShopBySlug, resolveShopByVerifiedHostname } from "@/data";
import { err, ok, type Result } from "@/domain/result";
import {
  defaultStoreConfig,
  fieldErrorsOf,
  mergeStoreConfig,
  StoreConfig,
  type DeepPartial,
  type FieldErrors,
} from "@/domain/store-config";
import { classifyRequest, hostEnv } from "@/domain/store-host";

// Online store use cases: the draft the owner edits, publishing it, the
// online switch, finding the shop behind a store address and what that
// store shows a customer. Every shop id comes from the server (the backend
// session or resolveStore), never from the browser.

export type ResolvedStore = { shopId: string; slug: string; basePath: string };

export type Storefront =
  | { status: "live"; config: StoreConfig; draft?: true }
  // The brand of the last published config (or the shop's name before the
  // first publish) so the offline page can still look like the shop.
  | { status: "offline"; brand: StoreConfig["brand"] };

async function shopName(shopId: string): Promise<string> {
  const shop = await forShop(shopId).shop.get();
  if (!shop) throw new Error(`No shop ${shopId}`);
  return shop.name;
}

// A stored config parsed with today's schema, so fields added since it was
// saved get their defaults. Null when it no longer parses.
function parseStored(stored: unknown): StoreConfig | null {
  const parsed = StoreConfig.safeParse(stored);
  if (!parsed.success) {
    console.error("store config failed to parse", fieldErrorsOf(parsed.error));
    return null;
  }
  return parsed.data;
}

async function currentDraft(shopId: string): Promise<StoreConfig> {
  const row = await forShop(shopId).storeConfig.get();
  return (row && parseStored(row.draft)) ?? defaultStoreConfig(await shopName(shopId));
}

export type StoreSettings = {
  draft: StoreConfig;
  /** Whether the store has ever been published. */
  published: boolean;
  online: boolean;
};

// What the backend Online Store page shows: the draft being edited and the
// state of the switch.
export async function getStoreSettings(shopId: string): Promise<StoreSettings> {
  const row = await forShop(shopId).storeConfig.get();
  return {
    draft: (row && parseStored(row.draft)) ?? defaultStoreConfig(await shopName(shopId)),
    published: row?.published != null,
    online: row?.online ?? false,
  };
}

// Merges the patch into the current draft (or the default config for a shop
// without one), validates the result and stores it. Customers never see the
// draft; only publishStore makes it live.
export async function saveDraft(
  shopId: string,
  patch: DeepPartial<StoreConfig>,
): Promise<Result<StoreConfig, FieldErrors>> {
  const merged = mergeStoreConfig(await currentDraft(shopId), patch);
  const parsed = StoreConfig.safeParse(merged);
  if (!parsed.success) return err(fieldErrorsOf(parsed.error));
  await forShop(shopId).storeConfig.saveDraft(parsed.data);
  return ok(parsed.data);
}

// Validates the draft, copies it to published, appends a version row and
// sets the store online, in one transaction.
export async function publishStore(shopId: string, userId: string): Promise<Result<void, FieldErrors>> {
  const row = await forShop(shopId).storeConfig.get();
  const draft = row ? row.draft : defaultStoreConfig(await shopName(shopId));
  const parsed = StoreConfig.safeParse(draft);
  if (!parsed.success) return err(fieldErrorsOf(parsed.error));
  await forShop(shopId).storeConfig.publish(parsed.data, userId);
  return ok(undefined);
}

export async function setStoreOnline(shopId: string, online: boolean): Promise<void> {
  const repo = forShop(shopId).storeConfig;
  const row = await repo.get();
  await repo.setOnline(online, row ? row.draft : defaultStoreConfig(await shopName(shopId)));
}

// The shop behind a store address (see domain/store-host for the rules), or
// null when the address matches no store. basePath is the prefix for links
// inside the store: "/s/<slug>" for the path form, "" on a store host.
export async function resolveStore(host: string, pathname: string): Promise<ResolvedStore | null> {
  const target = classifyRequest(host, pathname, hostEnv());
  switch (target.kind) {
    case "app":
      return null;
    case "path": {
      const shop = await resolveShopBySlug(target.slug);
      return shop ? { shopId: shop.shopId, slug: target.slug, basePath: `/s/${target.slug}` } : null;
    }
    case "subdomain": {
      const shop = await resolveShopBySlug(target.slug);
      return shop ? { shopId: shop.shopId, slug: target.slug, basePath: "" } : null;
    }
    case "domain": {
      const shop = await resolveShopByVerifiedHostname(target.hostname);
      return shop ? { ...shop, basePath: "" } : null;
    }
  }
}

// What a store shows: its published config while the store is online and
// has been published, otherwise offline. With `preview`, a member of the
// shop (userId from the server session) sees the draft instead, online or
// not; anyone else sees exactly what customers see.
export async function getStorefront(
  shopId: string,
  opts: { preview: boolean; userId?: string },
): Promise<Storefront> {
  const row = await forShop(shopId).storeConfig.get();

  if (opts.preview && opts.userId && (await activeShopForMember(opts.userId, shopId))) {
    const draft = (row && parseStored(row.draft)) ?? defaultStoreConfig(await shopName(shopId));
    return { status: "live", config: draft, draft: true };
  }

  const published = row?.published ? parseStored(row.published) : null;
  if (row?.online && published) return { status: "live", config: published };
  return { status: "offline", brand: published?.brand ?? defaultStoreConfig(await shopName(shopId)).brand };
}
