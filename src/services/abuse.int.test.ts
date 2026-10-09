import { afterEach, describe, expect, it, vi } from "vitest";
import { ageBucket } from "@/test/rate-limit";
import { rateLimit } from "./abuse";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const once = { capacity: 1, refillPerMinute: 0 };

describe("rateLimit clean-up", () => {
  it("now and then deletes buckets idle for a day, and only those", async () => {
    // Never clean up while setting up.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    await rateLimit("test:stale", once);
    await rateLimit("test:recent", once);
    await ageBucket("test:stale", 25);
    await ageBucket("test:recent", 1);

    // This call draws the clean-up.
    vi.spyOn(Math, "random").mockReturnValue(0);
    await rateLimit("test:other", once);

    vi.spyOn(Math, "random").mockReturnValue(0.5);
    // The stale bucket was deleted, so it starts full again.
    expect(await rateLimit("test:stale", once)).toBe(true);
    // The recent one is still there and still empty (no refill).
    expect(await rateLimit("test:recent", once)).toBe(false);
  });
});

describe("rateLimit test override", () => {
  it("lets every call through with RATE_LIMIT_DISABLED=1 outside production", async () => {
    await rateLimit("test:override", once);
    expect(await rateLimit("test:override", once)).toBe(false);

    vi.stubEnv("RATE_LIMIT_DISABLED", "1");
    expect(await rateLimit("test:override", once)).toBe(true);
    expect(await rateLimit("test:override", once)).toBe(true);
  });
});

describe("rateLimit", () => {
  it("allows up to capacity requests, then refuses", async () => {
    const opts = { capacity: 3, refillPerMinute: 1 };
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await rateLimit("test:burst", opts));

    expect(results).toEqual([true, true, true, false, false]);
  });

  it("keeps separate buckets per key", async () => {
    const opts = { capacity: 1, refillPerMinute: 1 };
    expect(await rateLimit("test:ip:1", opts)).toBe(true);
    expect(await rateLimit("test:ip:1", opts)).toBe(false);
    expect(await rateLimit("test:ip:2", opts)).toBe(true);
  });

  it("refills over time", async () => {
    // 60 tokens a minute is one a second; a round trip to the database is
    // well under that.
    const opts = { capacity: 1, refillPerMinute: 60 };
    expect(await rateLimit("test:refill", opts)).toBe(true);
    expect(await rateLimit("test:refill", opts)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await rateLimit("test:refill", opts)).toBe(true);
  });

  it("never lets concurrent requests take more than capacity", async () => {
    const opts = { capacity: 4, refillPerMinute: 0.001 };
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit("test:race", opts)));

    expect(results.filter(Boolean)).toHaveLength(4);
  });
});
