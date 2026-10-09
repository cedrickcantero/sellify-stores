import "server-only";
import { takeRateLimitToken } from "@/data";

export { clientIp, HONEYPOT_FIELD, isHoneypotTripped } from "@/domain/abuse";

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
  return takeRateLimitToken(key, opts.capacity, opts.refillPerMinute);
}
