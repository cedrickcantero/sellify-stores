import { describe, expect, it, vi } from "vitest";

// Simulates the shop insert failing after the user and organization were
// created (for example a dropped connection), to prove sign-up rolls back.
const failure = vi.hoisted(() => ({ insertShop: false }));
vi.mock("@/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data")>();
  return {
    ...actual,
    insertShop: async (...args: Parameters<typeof actual.insertShop>) => {
      if (failure.insertShop) throw new Error("simulated shop insert failure");
      return actual.insertShop(...args);
    },
  };
});

const { auth } = await import("@/auth/server");
const { registerShopOwner } = await import("./register-shop-owner");

const input = {
  name: "Aoife Murphy",
  email: "aoife@example.com",
  password: "correct-horse-battery",
  shopName: "FixIt Galway",
};

describe("registerShopOwner when creating the shop fails", () => {
  it("reports the failure and leaves no user behind", async () => {
    failure.insertShop = true;
    const result = await registerShopOwner(input);
    failure.insertShop = false;

    expect(result).toEqual({ ok: false, error: "signup_failed" });
    await expect(
      auth.api.signInEmail({ body: { email: input.email, password: input.password } }),
    ).rejects.toThrow();
  });

  it("lets the same email sign up again with the same shop slug", async () => {
    failure.insertShop = true;
    await registerShopOwner(input);
    failure.insertShop = false;

    const retry = await registerShopOwner(input);

    expect(retry.ok).toBe(true);
    // The rolled-back organization no longer holds the slug.
    expect(retry.ok && retry.value.slug).toBe("fixit-galway");
  });
});
