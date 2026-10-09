import type { StoreConfig, Weekday } from "./store-config";

// Repair booking slots. Opening hours are wall-clock times in the shop's
// timezone; slots are returned as UTC instants in Date.toISOString() form,
// the same keys bookedCounts uses. Timezone maths uses Intl only, so it
// follows the IANA rules (DST changes included) of the runtime.

/** How many days after today a customer may book. */
export const BOOKING_DAYS_AHEAD = 30;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const WEEKDAY_BY_UTC_DAY: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

type WallTime = { year: number; month: number; day: number; minutes: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timezone, f);
  }
  return f;
}

// The wall-clock date and time of an instant in a timezone.
function wallTime(instant: number, timezone: string): WallTime {
  const parts: Record<string, number> = {};
  for (const part of formatter(timezone).formatToParts(new Date(instant))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return { year: parts.year, month: parts.month, day: parts.day, minutes: parts.hour * 60 + parts.minute };
}

function wallAsUtc(t: WallTime): number {
  return Date.UTC(t.year, t.month - 1, t.day, 0, t.minutes);
}

// The instant a wall-clock time happens in a timezone, or null when the
// clock jumps over it (a spring-forward gap). In an autumn overlap it is the
// first of the two instants.
function wallToInstant(t: WallTime, timezone: string): number | null {
  const guess = wallAsUtc(t);
  const offsetAt = (instant: number) => wallAsUtc(wallTime(instant, timezone)) - instant;
  // A clock change moves the offset at most once in a day, so the offset
  // twelve hours either side gives every candidate instant.
  const candidates = [offsetAt(guess - DAY / 2), offsetAt(guess + DAY / 2)].map((offset) => guess - offset);
  for (const candidate of candidates.sort((a, b) => a - b)) {
    if (wallAsUtc(wallTime(candidate, timezone)) === guess) return candidate;
  }
  return null;
}

// "YYYY-MM-DD" as numbers, or null when it is not a real calendar day.
function parseDate(date: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isoDate(t: { year: number; month: number; day: number }): string {
  return `${String(t.year).padStart(4, "0")}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

/**
 * Free slot starts on `date` (YYYY-MM-DD in `timezone`): every
 * `slotMinutes` from opening, each ending by closing, leaving out slots
 * that start before `now` and slots already holding `capacity` bookings.
 */
export function generateSlots(input: {
  openingHours: StoreConfig["openingHours"];
  slotMinutes: number;
  capacity: number;
  date: string;
  timezone: string;
  now: Date;
  bookedCounts: Map<string, number>;
}): string[] {
  const day = parseDate(input.date);
  if (!day || !(input.slotMinutes > 0)) return [];
  const weekday = WEEKDAY_BY_UTC_DAY[new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()];
  const hours = input.openingHours[weekday];
  if (!hours) return [];

  const slots: string[] = [];
  const close = minutesOf(hours.close);
  for (let start = minutesOf(hours.open); start + input.slotMinutes <= close; start += input.slotMinutes) {
    const instant = wallToInstant({ ...day, minutes: start }, input.timezone);
    if (instant === null || instant < input.now.getTime()) continue;
    const iso = new Date(instant).toISOString();
    if ((input.bookedCounts.get(iso) ?? 0) >= input.capacity) continue;
    slots.push(iso);
  }
  return slots;
}

/** The calendar day (YYYY-MM-DD) of an instant in a timezone. */
export function slotDate(iso: string, timezone: string): string {
  return isoDate(wallTime(new Date(iso).getTime(), timezone));
}

/** The first and last day a customer may book: today in the shop's timezone to 30 days ahead. */
export function bookingWindow(now: Date, timezone: string): { first: string; last: string } {
  const today = wallTime(now.getTime(), timezone);
  const last = new Date(Date.UTC(today.year, today.month - 1, today.day + BOOKING_DAYS_AHEAD));
  return {
    first: isoDate(today),
    last: isoDate({ year: last.getUTCFullYear(), month: last.getUTCMonth() + 1, day: last.getUTCDate() }),
  };
}

/** A slot as the shop's emails name it: "Thursday 2pm", "Thursday 9:30am". */
export function formatSlotLabel(iso: string, timezone: string): string {
  const instant = new Date(iso);
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long" }).format(instant);
  return `${weekday} ${formatClock(iso, timezone)}`;
}

/** A slot's time of day in a timezone: "2pm", "9:30am". */
export function formatClock(iso: string, timezone: string): string {
  const { minutes } = wallTime(new Date(iso).getTime(), timezone);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${twelve}${suffix}` : `${twelve}:${String(minute).padStart(2, "0")}${suffix}`;
}

/** A day for customers: "Thursday 10 January". */
export function formatDayLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}
