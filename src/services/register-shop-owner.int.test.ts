import { describe, expect, it } from "vitest";
import { auth } from "@/auth/server";
import { forShop, resolveShopBySlug } from "@/data";
import { registerShopOwner } from "./register-shop-owner";

describe("registerShopOwner", () => {
  it("creates a shop with a slug from its name and makes it active when the owner logs in", async () => {
    const registered = await registerShopOwner({
      name: "Aoife Murphy",
      email: "aoife@example.com",
      password: "correct-horse-battery",
      shopName: "FixIt Galway",
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;

    expect(registered.value.slug).toBe("fixit-galway");
    expect(await forShop(registered.value.shopId).shop.get()).toMatchObject({
      name: "FixIt Galway",
      slug: "fixit-galway",
    });

    const login = await auth.api.signInEmail({
      body: { email: "aoife@example.com", password: "correct-horse-battery" },
      asResponse: true,
    });
    expect(login.ok).toBe(true);
    const cookie = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.id).toBe(registered.value.userId);
    expect(session?.session.activeOrganizationId).toBe(registered.value.shopId);
  });

  it("gives a second shop with the same name a different slug", async () => {
    const first = await registerShopOwner({
      name: "Owner One",
      email: "one@example.com",
      password: "password-one-123",
      shopName: "Phone Doctor",
    });
    const second = await registerShopOwner({
      name: "Owner Two",
      email: "two@example.com",
      password: "password-two-123",
      shopName: "Phone Doctor",
    });

    expect(first.ok && first.value.slug).toBe("phone-doctor");
    expect(second.ok && second.value.slug).toBe("phone-doctor-2");
  });

  it("rejects an email that is already registered", async () => {
    const input = {
      name: "Owner",
      email: "taken@example.com",
      password: "password-123",
      shopName: "Shop One",
    };
    await registerShopOwner(input);

    expect(await registerShopOwner({ ...input, shopName: "Shop Two" })).toEqual({
      ok: false,
      error: "email_taken",
    });
    expect(await resolveShopBySlug("shop-two")).toBeNull();
  });

  it("rejects invalid input without creating anything", async () => {
    expect(
      await registerShopOwner({
        name: "Owner",
        email: "not-an-email",
        password: "short",
        shopName: "Shop",
      }),
    ).toEqual({ ok: false, error: "invalid" });
    expect(await resolveShopBySlug("shop")).toBeNull();
  });
});
