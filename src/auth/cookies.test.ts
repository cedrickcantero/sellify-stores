import { describe, expect, it, vi } from "vitest";

// Next.js's cookie store is the boundary; record what gets deleted.
const deleted: unknown[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({ delete: (cookie: unknown) => deleted.push(cookie) }),
}));

process.env.BETTER_AUTH_URL = "https://shop.example.com";
process.env.BETTER_AUTH_SECRET = "unit-test-secret-unit-test-secret-1234";

const { clearSessionCookies } = await import("./cookies");

describe("clearSessionCookies", () => {
  it("deletes the __Secure- session cookie with its Secure attribute and path over https", async () => {
    await clearSessionCookies();

    expect(deleted).toContainEqual(
      expect.objectContaining({
        name: "__Secure-better-auth.session_token",
        secure: true,
        path: "/",
      }),
    );
  });
});
