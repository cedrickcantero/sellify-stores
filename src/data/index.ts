import "server-only";
import { buybackRepo, type BuybackRepo } from "./repos/buybacks";
import { emailOutboxRepo, type EmailOutboxRepo } from "./repos/email-outbox";
import { productRepo, type ProductRepo } from "./repos/products";
import { shopRepo, type ShopRepo } from "./repos/shop";

export type {
  Product,
  ProductFilter,
  ProductRepo,
  UpdateProductResult,
} from "./repos/products";
export type { Shop, ShopRepo } from "./repos/shop";
export type { EmailOutboxRepo, OutboxEmail } from "./repos/email-outbox";
export type {
  BasePriceRow,
  BuybackCustomer,
  BuybackDeduction,
  BuybackQuestionKey,
  BuybackQuote,
  BuybackQuoteListItem,
  BuybackRepo,
  BuybackStatus,
  OfferedBrand,
} from "./repos/buybacks";
export { deleteOrganization, insertShop, isUniqueViolation, resolveShopBySlug } from "./shops";
export { deviceCatalog, type DeviceModel } from "./device-catalog";
export {
  activeShopForMember,
  firstOrganizationIdForUser,
  setSessionActiveOrganization,
} from "./auth-sessions";
export { authDatabaseAdapter } from "./auth-adapter";

// Repositories for one tenant. Every query a repository runs is filtered by
// the shop id given here; later tickets add repairs, buybacks, sales, store
// config, domains and the email outbox.
export type ShopRepos = {
  shop: ShopRepo;
  emailOutbox: EmailOutboxRepo;
  buybacks: BuybackRepo;
  products: ProductRepo;
};

export function forShop(shopId: string): ShopRepos {
  return {
    shop: shopRepo(shopId),
    emailOutbox: emailOutboxRepo(shopId),
    buybacks: buybackRepo(shopId),
    products: productRepo(shopId),
  };
}
