import { describe, expect, it } from "vitest";
import { shopDayBounds } from "./shop-day";

describe("shopDayBounds", () => {
  it("is the UTC day in a UTC shop", () => {
    const { start, end } = shopDayBounds(new Date("2030-03-05T15:30:00Z"), "UTC");
    expect(start.toISOString()).toBe("2030-03-05T00:00:00.000Z");
    expect(end.toISOString()).toBe("2030-03-06T00:00:00.000Z");
  });

  it("starts the day an hour early for a summer Dublin shop (UTC+1)", () => {
    const { start, end } = shopDayBounds(new Date("2030-07-10T10:00:00Z"), "Europe/Dublin");
    expect(start.toISOString()).toBe("2030-07-09T23:00:00.000Z");
    expect(end.toISOString()).toBe("2030-07-10T23:00:00.000Z");
  });

  it("puts 23:30 UTC in tomorrow for a shop ahead of UTC", () => {
    const { start } = shopDayBounds(new Date("2030-07-10T23:30:00Z"), "Europe/Dublin");
    expect(start.toISOString()).toBe("2030-07-10T23:00:00.000Z");
  });

  it("puts 00:30 UTC in yesterday for a shop behind UTC", () => {
    const { start, end } = shopDayBounds(new Date("2030-01-11T00:30:00Z"), "America/New_York");
    expect(start.toISOString()).toBe("2030-01-10T05:00:00.000Z");
    expect(end.toISOString()).toBe("2030-01-11T05:00:00.000Z");
  });

  it("is 23 hours long on the spring clock change and 25 on the autumn one", () => {
    const spring = shopDayBounds(new Date("2030-03-31T12:00:00Z"), "Europe/Dublin");
    expect(spring.start.toISOString()).toBe("2030-03-31T00:00:00.000Z");
    expect(spring.end.toISOString()).toBe("2030-03-31T23:00:00.000Z");
    const autumn = shopDayBounds(new Date("2030-10-27T12:00:00Z"), "Europe/Dublin");
    expect(autumn.start.toISOString()).toBe("2030-10-26T23:00:00.000Z");
    expect(autumn.end.toISOString()).toBe("2030-10-28T00:00:00.000Z");
  });
});
