import { hashPassword } from "better-auth/crypto";
import { cancelBuybackQuote as cancelQuote, insertShopWithOwner } from "@/data/maintenance";
import { slugify } from "@/domain/slug";

export type TestShop = {
  shopId: string;
  slug: string;
  name: string;
  owner: { userId: string; name: string; email: string; password: string };
};

const PASSWORD = "test-password-123";

async function seedShop(
  url: string,
  passwordHash: string,
  name: string,
  ownerName: string,
  email: string,
): Promise<TestShop> {
  // On purpose, no slug uniqueness logic (that lives in the sign-up use case):
  // the tables are emptied before each test and the two seed names differ.
  const slug = slugify(name);
  const { shopId, userId } = await insertShopWithOwner(url, {
    shopName: name,
    slug,
    ownerName,
    email,
    passwordHash,
  });
  return { shopId, slug, name, owner: { userId, name: ownerName, email, password: PASSWORD } };
}

// Two independent shops, each with an owner who can log in with
// owner.email and owner.password. Rows are written directly (one statement
// per shop, both at once) so every test can afford to seed; the sign-up use
// case that normally creates them has its own integration tests. Integration
// tests use shop B to prove shop A's repositories never see or change another
// shop's rows.
export async function seedTwoShops(): Promise<{ shopA: TestShop; shopB: TestShop }> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("seedTwoShops runs only in integration tests");
  const passwordHash = await hashPassword(PASSWORD);
  const [shopA, shopB] = await Promise.all([
    seedShop(url, passwordHash, "FixIt Galway", "Aoife Owner", "owner-a@example.com"),
    seedShop(url, passwordHash, "Phone Clinic Cork", "Brian Owner", "owner-b@example.com"),
  ]);
  return { shopA, shopB };
}

// Cancels a buyback quote (nothing in the app does yet).
export async function cancelBuybackQuote(quoteId: string): Promise<void> {
  await cancelQuote(process.env.TEST_DATABASE_URL!, quoteId);
}
