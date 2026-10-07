import "server-only";
import { shopRepo, type ShopRepo } from "./repos/shop";

export type { Shop, ShopRepo } from "./repos/shop";
export { deleteOrganization, insertShop, isUniqueViolation, resolveShopBySlug } from "./shops";
export { deviceCatalog, type DeviceModel } from "./device-catalog";
export {
  activeShopForMember,
  firstOrganizationIdForUser,
  setSessionActiveOrganization,
} from "./auth-sessions";
export { authDatabaseAdapter } from "./auth-adapter";
export { closeDb } from "./db";

// Repositories for one tenant. Every query a repository runs is filtered by
// the shop id given here; later tickets add products, repairs, buybacks,
// sales, store config, domains and the email outbox.
export type ShopRepos = {
  shop: ShopRepo;
};

export function forShop(shopId: string): ShopRepos {
  return {
    shop: shopRepo(shopId),
  };
}
