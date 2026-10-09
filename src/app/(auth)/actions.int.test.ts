import { describe, expect, it, vi } from "vitest";

// The request is the system boundary for server actions: give them fixed
// request headers and make redirect() observable.
const requestHeaders = { current: new Headers() };
vi.mock("next/headers", () => ({
  headers: async () => requestHeaders.current,
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const { signInAction, signUpAction } = await import("./actions");
const { seedTwoShops } = await import("@/test/seed");

const TOO_MANY = "Too many attempts. Wait a minute, then try again.";
// For tests that run 20 to 40 logins in a row, about a second each on Neon.
const SLOW = 120_000;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

describe("login rate limit", () => {
  it("refuses a sixth quick login attempt for one email from one IP with a friendly error", async () => {
    const { shopA } = await seedTwoShops();
    requestHeaders.current = new Headers({ "x-real-ip": "203.0.113.50" });
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(await signInAction({}, form({ email: shopA.owner.email, password: "wrong-password" })));
    }

    expect(attempts.slice(0, 5).map((a) => a.error)).toEqual(Array(5).fill("Wrong email or password."));
    expect(attempts[5]).toEqual({ values: { email: shopA.owner.email }, error: TOO_MANY });
  });

  it("does not lock the owner out when someone else hammers their email from other IPs", async () => {
    const { shopA } = await seedTwoShops();
    for (let i = 0; i < 6; i++) {
      requestHeaders.current = new Headers({ "x-real-ip": `203.0.113.${i + 1}` });
      const result = await signInAction({}, form({ email: shopA.owner.email, password: "wrong-password" }));
      expect(result.error).toBe("Wrong email or password.");
    }

    // The owner, on their own IP, still gets through to the password check.
    requestHeaders.current = new Headers({ "x-real-ip": "198.51.100.77" });
    await expect(
      signInAction({}, form({ email: shopA.owner.email, password: shopA.owner.password })),
    ).rejects.toThrow("redirect:/dashboard");
  });

  it("still caps attempts on one email across many IPs", async () => {
    const { shopA } = await seedTwoShops();
    const errors: (string | undefined)[] = [];
    // The loose per-email bucket holds 30 and refills 10 a minute.
    for (let i = 0; i < 40 && errors.at(-1) !== TOO_MANY; i++) {
      requestHeaders.current = new Headers({ "x-real-ip": `192.0.2.${i + 1}` });
      errors.push((await signInAction({}, form({ email: shopA.owner.email, password: "nope-nope" }))).error);
    }

    expect(errors.slice(0, 30).every((e) => e === "Wrong email or password.")).toBe(true);
    expect(errors.at(-1)).toBe(TOO_MANY);
  }, SLOW);

  it("refuses many logins from one IP across different emails", async () => {
    requestHeaders.current = new Headers({ "x-real-ip": "198.51.100.20" });
    const errors: (string | undefined)[] = [];
    // The IP bucket holds 20 and refills slowly (10 a minute), so a few
    // attempts may be refilled while the loop runs.
    for (let i = 0; i < 26 && errors.at(-1) !== TOO_MANY; i++) {
      const result = await signInAction({}, form({ email: `nobody${i}@example.com`, password: "x" }));
      errors.push(result.error);
    }

    expect(errors.slice(0, 20).every((e) => e === "Wrong email or password.")).toBe(true);
    expect(errors.at(-1)).toBe(TOO_MANY);
  }, SLOW);
});

describe("sign-up rate limit", () => {
  it("refuses a sixth sign-up from one IP", async () => {
    requestHeaders.current = new Headers({ "x-real-ip": "198.51.100.30" });
    const results = [];
    for (let i = 0; i < 6; i++) {
      // Invalid input, so nothing is created; the attempt still counts.
      results.push(await signUpAction({}, form({ name: "", email: `new${i}@example.com`, shopName: "", password: "short" })));
    }

    expect(results.slice(0, 5).every((r) => r.error !== TOO_MANY)).toBe(true);
    expect(results[5].error).toBe(TOO_MANY);
  });
});
