import "server-only";
import { buybackRepo, type BuybackRepo } from "./repos/buybacks";
import { emailOutboxRepo, type EmailOutboxRepo } from "./repos/email-outbox";
import { productRepo, type ProductRepo } from "./repos/products";
import { db, type Tx } from "./db";
import { repairsRepo, type RepairsRepo } from "./repos/repairs";
import { customDomainRepo, type CustomDomainRepo } from "./repos/custom-domain";
import { salesRepo, type SalesRepo } from "./repos/sales";
import { shopRepo, type ShopRepo } from "./repos/shop";
import { storeConfigRepo, type StoreConfigRepo } from "./repos/store-config";

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
export {
  DeviceModelNotFoundError,
  RepairTypeNotFoundError,
  SlotTakenError,
  type NewTicket,
  type OfferedBrand as OfferedRepairBrand,
  type RepairPrice,
  type RepairsRepo,
  type RepairTicket,
  type RepairTicketSource,
  type RepairTicketStatus,
  type RepairType,
  type TicketFilter,
} from "./repos/repairs";
export type { DbExecutor, Tx } from "./db";
export type { StoreConfigRepo, StoreConfigRow, StoreConfigVersion, StoredConfig } from "./repos/store-config";
export type { CustomDomain, CustomDomainRepo, CustomDomainStatus } from "./repos/custom-domain";
export { resolveShopByVerifiedHostname } from "./store-resolution";
export { deleteStaleRateLimitBuckets, takeRateLimitToken } from "./rate-limit";
export { decrementStock } from "./repos/sales";
export type {
  OnlineSaleInput,
  SaleChannel,
  SaleFilter,
  SaleItem,
  SalesRepo,
  SaleStatus,
  SaleWithItems,
} from "./repos/sales";
export { deleteOrganization, insertShop, isUniqueViolation, resolveShopBySlug } from "./shops";
export { deviceCatalog, type DeviceModel } from "./device-catalog";
export {
  activeShopForMember,
  firstOrganizationIdForUser,
  setSessionActiveOrganization,
} from "./auth-sessions";
export { authDatabaseAdapter } from "./auth-adapter";

// Repositories for one tenant. Every query a repository runs is filtered by
// the shop id given here; a later ticket adds sales.
export type ShopRepos = {
  shop: ShopRepo;
  emailOutbox: EmailOutboxRepo;
  buybacks: BuybackRepo;
  products: ProductRepo;
  repairs: RepairsRepo;
  storeConfig: StoreConfigRepo;
  customDomains: CustomDomainRepo;
  sales: SalesRepo;
};

export function forShop(shopId: string): ShopRepos {
  return {
    shop: shopRepo(shopId),
    emailOutbox: emailOutboxRepo(shopId),
    buybacks: buybackRepo(shopId),
    products: productRepo(shopId),
    repairs: repairsRepo(shopId),
    storeConfig: storeConfigRepo(shopId),
    customDomains: customDomainRepo(shopId),
    sales: salesRepo(shopId),
  };
}

// Runs `run` in one database transaction, for use cases that write a ticket
// and its email outbox rows together: `inTransaction((tx) => repairs.insertTicket(tx, input))`.
export function inTransaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(run);
}
