import { describe, expect, it } from "vitest";
import { rateLimit } from "./abuse";

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
