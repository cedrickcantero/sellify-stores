import "server-only";
import { deleteStaleRateLimitBuckets, takeRateLimitToken } from "@/data";
import { isRateLimitDisabled } from "@/domain/abuse";

export { clientIp, HONEYPOT_FIELD, isHoneypotTripped } from "@/domain/abuse";

// About one call in this many also deletes buckets idle for a day, so the
// table never grows without bound and no scheduled job is needed.
const CLEANUP_ONE_IN = 100;
const STALE_AFTER_HOURS = 24;

// True when the caller may go ahead, false when `key` has used up its
// tokens. Each key is a Postgres token bucket holding up to `capacity`
// tokens, refilled at `refillPerMinute`; every allowed call takes one.
// Key by what is being protected and who is calling: "book:ip:<ip>".
export async function rateLimit(
  key: string,
  opts: { capacity: number; refillPerMinute: number },
): Promise<boolean> {
  if (!(opts.capacity >= 1) || !(opts.refillPerMinute >= 0)) {
    throw new Error("rateLimit: capacity must be at least 1 and refill at least 0");
  }
  if (isRateLimitDisabled(process.env)) return true;
  if (Math.random() * CLEANUP_ONE_IN < 1) {
    // Best effort: a failed clean-up must never fail the request.
    await deleteStaleRateLimitBuckets(STALE_AFTER_HOURS).catch((error: unknown) => {
      console.error("rate limit clean-up failed", error);
    });
  }
  return takeRateLimitToken(key, opts.capacity, opts.refillPerMinute);
}
