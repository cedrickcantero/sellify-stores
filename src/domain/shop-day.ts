// The day a moment falls in, in a shop's timezone, as the instants it starts
// and ends. `start` is inclusive and `end` exclusive, matching the `since` and
// `until` of the sales list. A day is 23 or 25 hours long when the clocks change.

function partsIn(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Milliseconds the timezone is ahead of UTC at this instant.
function offsetMs(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// The instant at which the wall clock in `timeZone` reads midnight on this date.
function midnightOf(year: number, month: number, day: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day);
  // The offset can differ at the wall time and at the answer when a clock
  // change falls between them, so settle it in two passes.
  const first = wall - offsetMs(new Date(wall), timeZone);
  return new Date(wall - offsetMs(new Date(first), timeZone));
}

export function shopDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const { year, month, day } = partsIn(now, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: midnightOf(year, month, day, timeZone),
    end: midnightOf(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone),
  };
}
