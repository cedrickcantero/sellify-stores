import { describe, expect, it } from "vitest";
import { StoreConfig } from "./store-config";
import { bookingWindow, formatSlotLabel, generateSlots, slotDate } from "./repair-slots";

const hours = StoreConfig.parse({ brand: { name: "Test" } }).openingHours;
const ninetoEleven = { ...hours, thu: { open: "09:00", close: "11:00" } };

// 2030-01-10 is a Thursday. Dublin is on UTC (GMT) in January.
const base = {
  openingHours: ninetoEleven,
  slotMinutes: 30,
  capacity: 1,
  date: "2030-01-10",
  timezone: "Europe/Dublin",
  now: new Date("2030-01-01T00:00:00.000Z"),
  bookedCounts: new Map<string, number>(),
};

describe("generateSlots", () => {
  it("returns slot starts inside that weekday's opening hours", () => {
    expect(generateSlots(base)).toEqual([
      "2030-01-10T09:00:00.000Z",
      "2030-01-10T09:30:00.000Z",
      "2030-01-10T10:00:00.000Z",
      "2030-01-10T10:30:00.000Z",
    ]);
  });

  it("returns no slots on a closed day", () => {
    // 2030-01-13 is a Sunday, closed by default.
    expect(generateSlots({ ...base, date: "2030-01-13" })).toEqual([]);
  });

  it("respects the slot length and never runs a slot past closing", () => {
    expect(generateSlots({ ...base, slotMinutes: 60 })).toEqual([
      "2030-01-10T09:00:00.000Z",
      "2030-01-10T10:00:00.000Z",
    ]);
    const odd = { ...hours, thu: { open: "09:00", close: "10:40" } };
    expect(generateSlots({ ...base, openingHours: odd, slotMinutes: 30 })).toEqual([
      "2030-01-10T09:00:00.000Z",
      "2030-01-10T09:30:00.000Z",
      "2030-01-10T10:00:00.000Z",
    ]);
  });

  it("leaves out slots that start before now in the shop's timezone", () => {
    // 09:40 Dublin time on the day itself: 09:00 and 09:30 have gone.
    const now = new Date("2030-01-10T09:40:00.000Z");
    expect(generateSlots({ ...base, now })).toEqual(["2030-01-10T10:00:00.000Z", "2030-01-10T10:30:00.000Z"]);
  });

  it("uses the shop's timezone, not UTC, for past slots and hours", () => {
    // Auckland in January is NZDT, UTC+13. Thursday 09:00 there is
    // Wednesday 20:00 UTC.
    const auckland = { ...base, timezone: "Pacific/Auckland" };
    expect(generateSlots(auckland)[0]).toBe("2030-01-09T20:00:00.000Z");
    // 20:45 UTC is 09:45 Thursday in Auckland: 09:00 and 09:30 are past.
    expect(generateSlots({ ...auckland, now: new Date("2030-01-09T20:45:00.000Z") })).toEqual([
      "2030-01-09T21:00:00.000Z",
      "2030-01-09T21:30:00.000Z",
    ]);
  });

  it("leaves out slots at capacity", () => {
    const bookedCounts = new Map([
      ["2030-01-10T09:00:00.000Z", 1],
      ["2030-01-10T10:00:00.000Z", 2],
    ]);
    expect(generateSlots({ ...base, bookedCounts })).toEqual([
      "2030-01-10T09:30:00.000Z",
      "2030-01-10T10:30:00.000Z",
    ]);
    expect(generateSlots({ ...base, bookedCounts, capacity: 2 })).toEqual([
      "2030-01-10T09:00:00.000Z",
      "2030-01-10T09:30:00.000Z",
      "2030-01-10T10:30:00.000Z",
    ]);
  });

  it("follows Dublin across the late October clock change", () => {
    const allWeek = { open: "09:00", close: "10:00" };
    const openingHours = { ...hours, sat: allWeek, sun: allWeek, mon: allWeek };
    const input = { ...base, openingHours, slotMinutes: 60, now: new Date("2026-10-01T00:00:00Z") };
    // Clocks go back at 02:00 on Sunday 25 October 2026 (IST, UTC+1, to GMT).
    expect(generateSlots({ ...input, date: "2026-10-24" })).toEqual(["2026-10-24T08:00:00.000Z"]);
    expect(generateSlots({ ...input, date: "2026-10-25" })).toEqual(["2026-10-25T09:00:00.000Z"]);
    expect(generateSlots({ ...input, date: "2026-10-26" })).toEqual(["2026-10-26T09:00:00.000Z"]);
  });

  it("follows Auckland across its September clock change", () => {
    const allWeek = { open: "09:00", close: "10:00" };
    const openingHours = { ...hours, sat: allWeek, sun: allWeek, mon: allWeek };
    const input = {
      ...base,
      openingHours,
      slotMinutes: 60,
      timezone: "Pacific/Auckland",
      now: new Date("2026-09-01T00:00:00Z"),
    };
    // Clocks go forward at 02:00 on Sunday 27 September 2026 (NZST +12 to NZDT +13).
    expect(generateSlots({ ...input, date: "2026-09-26" })).toEqual(["2026-09-25T21:00:00.000Z"]);
    expect(generateSlots({ ...input, date: "2026-09-27" })).toEqual(["2026-09-26T20:00:00.000Z"]);
  });

  it("skips a wall time the clock change jumps over", () => {
    // Auckland skips 02:00 to 03:00 on 27 September 2026.
    const night = { ...hours, sun: { open: "01:00", close: "04:00" } };
    const slots = generateSlots({
      ...base,
      openingHours: night,
      slotMinutes: 60,
      timezone: "Pacific/Auckland",
      date: "2026-09-27",
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(slots).toEqual(["2026-09-26T13:00:00.000Z", "2026-09-26T14:00:00.000Z"]);
  });

  it("returns nothing for a malformed date", () => {
    expect(generateSlots({ ...base, date: "2030-02-30" })).toEqual([]);
    expect(generateSlots({ ...base, date: "next thursday" })).toEqual([]);
  });
});

describe("slotDate", () => {
  it("is the calendar day of an instant in the shop's timezone", () => {
    expect(slotDate("2030-01-09T20:00:00.000Z", "Pacific/Auckland")).toBe("2030-01-10");
    expect(slotDate("2030-01-09T20:00:00.000Z", "Europe/Dublin")).toBe("2030-01-09");
  });
});

describe("bookingWindow", () => {
  it("runs from today in the shop's timezone to 30 days ahead", () => {
    // 23:30 UTC on 31 December is already 1 January in Auckland.
    expect(bookingWindow(new Date("2029-12-31T23:30:00Z"), "Pacific/Auckland")).toEqual({
      first: "2030-01-01",
      last: "2030-01-31",
    });
    expect(bookingWindow(new Date("2029-12-31T23:30:00Z"), "Europe/Dublin")).toEqual({
      first: "2029-12-31",
      last: "2030-01-30",
    });
  });
});

describe("formatSlotLabel", () => {
  it("names the weekday and a short time in the shop's timezone", () => {
    expect(formatSlotLabel("2030-01-10T14:00:00.000Z", "Europe/Dublin")).toBe("Thursday 2pm");
    expect(formatSlotLabel("2030-01-10T09:30:00.000Z", "Europe/Dublin")).toBe("Thursday 9:30am");
    expect(formatSlotLabel("2030-01-09T23:00:00.000Z", "Pacific/Auckland")).toBe("Thursday 12pm");
  });
});
