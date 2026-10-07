import { registerShopOwner } from "@/services/register-shop-owner";

export type TestShop = {
  shopId: string;
  slug: string;
  name: string;
  owner: { userId: string; name: string; email: string; password: string };
};

async function seedShop(name: string, ownerName: string, email: string): Promise<TestShop> {
  const password = "test-password-123";
  const result = await registerShopOwner({ name: ownerName, email, password, shopName: name });
  if (!result.ok) {
    throw new Error(`seedTwoShops: could not create ${name}: ${result.error}`);
  }
  return {
    shopId: result.value.shopId,
    slug: result.value.slug,
    name,
    owner: { userId: result.value.userId, name: ownerName, email, password },
  };
}

// Two independent shops, each with its own owner, created through the real
// sign-up use case. Integration tests use shop B to prove shop A's
// repositories never see or change another shop's rows.
export async function seedTwoShops(): Promise<{ shopA: TestShop; shopB: TestShop }> {
  const shopA = await seedShop("FixIt Galway", "Aoife Owner", "owner-a@example.com");
  const shopB = await seedShop("Phone Clinic Cork", "Brian Owner", "owner-b@example.com");
  return { shopA, shopB };
}
