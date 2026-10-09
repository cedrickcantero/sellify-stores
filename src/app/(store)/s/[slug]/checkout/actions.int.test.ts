import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeGateway } from "@/test/fake-gateway";

// The request boundary: cookies, headers and the store resolved to the shop
// the test names. The payment provider is the fake gateway.
const jar = new Map<string, string>();
const requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => requestHeaders,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const current = { shopId: "", preview: false };
vi.mock("../store-context", () => ({
  requireLiveStore: async () => ({ shopId: current.shopId, basePath: "/s/test", preview: current.preview }),
}));
// A basket read that is already out of date when checkout runs (stock went
// between that read and the payment session), to reach the second check.
const staleBasket = vi.hoisted(() => ({ lines: null as { productId: string; qty: number }[] | null }));
vi.mock("@/services/cart", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/cart")>();
  return {
    ...original,
    loadBasket: async (shopId: string) => {
      const real = await original.loadBasket(shopId);
      return staleBasket.lines ? { ...real, saved: staleBasket.lines, lines: staleBasket.lines } : real;
    },
  };
});
const gateway = createFakeGateway();
vi.mock("@/payments/stripe", () => ({ getPaymentGateway: () => gateway }));

const { startCheckout } = await import("./actions");
const { cartCookieName } = await import("@/services/cart");
const { forShop } = await import("@/data");
const { seedTwoShops } = await import("@/test/seed");
const { PaymentsNotConfiguredError } = await import("@/payments/gateway");

const product = (title: string, stockQty: number) => ({
  title,
  kind: "phone" as const,
  condition: "good" as const,
  price: 19900,
  stockQty,
  images: [],
  deviceModelId: null,
});

// Server actions end in redirect(), which throws; the outcome is where to.
async function run(action: Promise<unknown>): Promise<{ redirectTo?: string; state?: unknown }> {
  try {
    return { state: await action };
  } catch (error) {
    const digest = (error as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return { redirectTo: digest.split(";")[2] };
    throw error;
  }
}

const rawLines = (shopId: string) => JSON.parse(jar.get(cartCookieName(shopId)) ?? "[]");

beforeEach(() => {
  jar.clear();
  staleBasket.lines = null;
  gateway.created.length = 0;
  requestHeaders.set("host", "shop.example.test");
  requestHeaders.set("x-forwarded-proto", "https");
  requestHeaders.set("x-real-ip", `10.0.0.${Math.floor(Math.random() * 250)}`);
  current.preview = false;
});

async function setup(stock = 3) {
  const { shopA, shopB } = await seedTwoShops();
  current.shopId = shopA.shopId;
  const phone = await forShop(shopA.shopId).products.create(product("Pixel 7", stock));
  jar.set(cartCookieName(shopA.shopId), JSON.stringify([{ productId: phone.id, qty: 2 }]));
  return { shopA, shopB, phone };
}

describe("startCheckout", () => {
  it("sends the customer to Stripe with this store's return addresses", async () => {
    await setup();
    const { redirectTo } = await run(startCheckout("test", {}, new FormData()));
    expect(redirectTo).toMatch(/^https:\/\/checkout\.example\.test\//);
    expect(gateway.created[0].successUrl).toBe(
      "https://shop.example.test/s/test/checkout/success?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(gateway.created[0].cancelUrl).toBe("https://shop.example.test/s/test/basket");
  });

  it("keeps ?preview on the return addresses in a preview", async () => {
    await setup();
    current.preview = true;
    await run(startCheckout("test", {}, new FormData()));
    expect(gateway.created[0].successUrl).toBe(
      "https://shop.example.test/s/test/checkout/success?preview&session_id={CHECKOUT_SESSION_ID}",
    );
    expect(gateway.created[0].cancelUrl).toBe("https://shop.example.test/s/test/basket?preview");
  });

  it("tells the customer when stock dropped: the basket is updated and no session is created", async () => {
    const { shopA, phone } = await setup(1);
    const { redirectTo } = await run(startCheckout("test", {}, new FormData()));
    expect(redirectTo).toBe("/s/test/basket?stock=changed");
    expect(rawLines(shopA.shopId)).toEqual([{ productId: phone.id, qty: 1 }]);
    expect(gateway.created).toHaveLength(0);
  });

  it("drops a line that sold out after the basket was read: no session, basket updated", async () => {
    const { shopA, phone } = await setup();
    staleBasket.lines = [{ productId: phone.id, qty: 2 }];
    await forShop(shopA.shopId).products.update(phone.id, product("Pixel 7", 0), 3);
    const { redirectTo } = await run(startCheckout("test", {}, new FormData()));
    expect(redirectTo).toBe("/s/test/basket?stock=changed");
    expect(jar.has(cartCookieName(shopA.shopId))).toBe(false);
    expect(gateway.created).toHaveLength(0);
  });

  it("quietly creates nothing when the honeypot is filled", async () => {
    await setup();
    const form = new FormData();
    form.set("website", "http://spam.example");
    const { redirectTo } = await run(startCheckout("test", {}, form));
    expect(redirectTo).toBe("/s/test/basket");
    expect(gateway.created).toHaveLength(0);
  });

  it("limits checkout attempts per IP", async () => {
    await setup();
    requestHeaders.set("x-real-ip", "203.0.113.9");
    let last: Awaited<ReturnType<typeof run>> = {};
    for (let i = 0; i < 12; i++) last = await run(startCheckout("test", {}, new FormData()));
    expect(last.state).toEqual({ message: "Too many attempts. Wait a minute, then try again." });
    expect(gateway.created.length).toBeLessThan(12);
  });

  it("redirects an empty basket back to the basket", async () => {
    const { shopA } = await setup();
    jar.delete(cartCookieName(shopA.shopId));
    expect((await run(startCheckout("test", {}, new FormData()))).redirectTo).toBe("/s/test/basket");
    expect(gateway.created).toHaveLength(0);
  });

  it("shows a clear message, not a crash, when the Stripe keys are missing", async () => {
    await setup();
    const spy = vi.spyOn(gateway, "createSession").mockRejectedValueOnce(new PaymentsNotConfiguredError("STRIPE_SECRET_KEY"));
    const { state } = await run(startCheckout("test", {}, new FormData()));
    spy.mockRestore();
    expect(state).toEqual({ message: "Checkout is not available right now. Please try again later." });
  });
});
