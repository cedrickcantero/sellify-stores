import { beforeEach, describe, expect, it, vi } from "vitest";

// The request boundary: an in-memory cookie jar, and the store resolved to
// whichever shop the test names (the real resolution is tested with T8).
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
const current = { shopId: "" };
vi.mock("./store-context", () => ({
  requireLiveStore: async () => ({ shopId: current.shopId, basePath: "/s/test" }),
}));

const { addToBasket, removeFromBasket, setBasketQty } = await import("./basket-actions");
const { cartCookieName, readBuyableCart, writeCart } = await import("@/services/cart");
const { forShop } = await import("@/data");
const { seedTwoShops } = await import("@/test/seed");

const input = (title: string, stockQty: number) => ({
  title,
  kind: "phone" as const,
  condition: "good" as const,
  price: 19900,
  stockQty,
  images: [],
  deviceModelId: null,
});

function form(qty: string): FormData {
  const data = new FormData();
  data.set("qty", qty);
  return data;
}

// Server actions end in redirect(), which throws; the outcome is the cookie.
async function run<T>(action: Promise<T>): Promise<T | undefined> {
  try {
    return await action;
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") return undefined;
    throw error;
  }
}

const rawLines = (shopId: string) => JSON.parse(jar.get(cartCookieName(shopId)) ?? "[]");

beforeEach(() => jar.clear());

async function setup() {
  const seeded = await seedTwoShops();
  current.shopId = seeded.shopA.shopId;
  return seeded;
}

describe("basket actions", () => {
  it("adds a product, sets its quantity and removes it", async () => {
    const { shopA } = await setup();
    const phone = await forShop(shopA.shopId).products.create(input("Pixel 7", 5));

    await run(addToBasket("s", phone.id, {}, new FormData()));
    await run(addToBasket("s", phone.id, {}, new FormData()));
    expect(rawLines(shopA.shopId)).toEqual([{ productId: phone.id, qty: 2 }]);

    await setBasketQty("s", phone.id, {}, form("4"));
    expect(rawLines(shopA.shopId)).toEqual([{ productId: phone.id, qty: 4 }]);

    await removeFromBasket("s", phone.id);
    expect(jar.has(cartCookieName(shopA.shopId))).toBe(false);
  });

  it("caps a quantity at stock and says so", async () => {
    const { shopA } = await setup();
    const phone = await forShop(shopA.shopId).products.create(input("Pixel 7", 2));
    await run(addToBasket("s", phone.id, {}, new FormData()));

    const state = await setBasketQty("s", phone.id, {}, form("9"));
    expect(rawLines(shopA.shopId)).toEqual([{ productId: phone.id, qty: 2 }]);
    expect(state.message).toMatch(/only 2/i);
  });

  it("refuses an empty or invalid quantity and leaves the line alone", async () => {
    const { shopA } = await setup();
    const phone = await forShop(shopA.shopId).products.create(input("Pixel 7", 5));
    await run(addToBasket("s", phone.id, {}, new FormData()));

    for (const bad of ["", "0", "abc", "100"]) {
      const state = await setBasketQty("s", phone.id, {}, form(bad));
      expect(state.message).toMatch(/quantity/i);
    }
    expect(rawLines(shopA.shopId)).toEqual([{ productId: phone.id, qty: 1 }]);
  });

  it("removes a line whose product was archived since it was added", async () => {
    const { shopA } = await setup();
    const phone = await forShop(shopA.shopId).products.create(input("Pixel 7", 5));
    await run(addToBasket("s", phone.id, {}, new FormData()));
    await forShop(shopA.shopId).products.remove(phone.id);

    const state = await setBasketQty("s", phone.id, {}, form("2"));
    expect(rawLines(shopA.shopId)).toEqual([]);
    expect(state.message).toBeDefined();
  });

  it("adds nothing for a sold out product", async () => {
    const { shopA } = await setup();
    const phone = await forShop(shopA.shopId).products.create(input("Pixel 7", 0));

    const state = await run(addToBasket("s", phone.id, {}, new FormData()));
    expect(state?.message).toMatch(/sold out/i);
    expect(jar.has(cartCookieName(shopA.shopId))).toBe(false);
  });

  it("adds nothing for another shop's product", async () => {
    const { shopA, shopB } = await setup();
    const theirs = await forShop(shopB.shopId).products.create(input("Theirs", 5));

    await run(addToBasket("s", theirs.id, {}, new FormData()));
    expect(jar.has(cartCookieName(shopA.shopId))).toBe(false);
  });

  it("tells the customer when an add stops at the stock they can buy", async () => {
    const { shopA } = await setup();
    const phone = await forShop(shopA.shopId).products.create(input("Pixel 7", 1));
    await run(addToBasket("s", phone.id, {}, new FormData()));
    const state = await run(addToBasket("s", phone.id, {}, new FormData()));
    expect(state?.message).toMatch(/all we have/i);
    expect(rawLines(shopA.shopId)).toEqual([{ productId: phone.id, qty: 1 }]);
  });

  it("refuses an invalid slug or product id before touching the cookie", async () => {
    const { shopA } = await setup();
    const state = await run(addToBasket("s", "x".repeat(101), {}, new FormData()));
    expect(state?.message).toBeDefined();
    expect(jar.has(cartCookieName(shopA.shopId))).toBe(false);
  });

  it("drops forged and dead lines from the cookie on the next write", async () => {
    const { shopA, shopB } = await setup();
    const live = await forShop(shopA.shopId).products.create(input("Live", 5));
    const gone = await forShop(shopA.shopId).products.create(input("Gone", 5));
    const soldOut = await forShop(shopA.shopId).products.create(input("Sold out", 0));
    const theirs = await forShop(shopB.shopId).products.create(input("Theirs", 5));
    await forShop(shopA.shopId).products.remove(gone.id);
    await writeCart(shopA.shopId, [
      { productId: live.id, qty: 9 },
      { productId: gone.id, qty: 1 },
      { productId: soldOut.id, qty: 1 },
      { productId: theirs.id, qty: 1 },
      { productId: "forged", qty: 1 },
    ]);

    await removeFromBasket("s", "forged");
    expect(rawLines(shopA.shopId)).toEqual([{ productId: live.id, qty: 5 }]);
  });
});

describe("readBuyableCart", () => {
  it("returns only lines that can be bought now, clamped to stock", async () => {
    const { shopA, shopB } = await setup();
    const live = await forShop(shopA.shopId).products.create(input("Live", 2));
    const gone = await forShop(shopA.shopId).products.create(input("Gone", 5));
    const theirs = await forShop(shopB.shopId).products.create(input("Theirs", 5));
    await forShop(shopA.shopId).products.remove(gone.id);
    await writeCart(shopA.shopId, [
      { productId: live.id, qty: 5 },
      { productId: gone.id, qty: 1 },
      { productId: theirs.id, qty: 1 },
      { productId: "forged", qty: 1 },
    ]);

    const lines = await readBuyableCart(shopA.shopId);
    expect(lines).toEqual([{ productId: live.id, qty: 2 }]);
    // The basket badge is the sum of these quantities: dead lines add nothing.
    expect(lines.reduce((sum, line) => sum + line.qty, 0)).toBe(2);
  });
});
