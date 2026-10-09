import { sql } from "drizzle-orm";
import { db } from "./db";

// Token bucket in one atomic statement. A new key starts full and pays one
// token. An existing bucket is refilled for the time since it was last
// touched (capped at capacity) and pays one token only if at least one is
// available; ON CONFLICT DO UPDATE locks the row, so concurrent requests for
// the same key are serialised. No returned row means no token was left.
export async function takeRateLimitToken(
  key: string,
  capacity: number,
  refillPerMinute: number,
): Promise<boolean> {
  const refilled = sql`least(${capacity}::double precision, rate_limit_bucket.tokens + extract(epoch from (now() - rate_limit_bucket.updated_at)) * ${refillPerMinute}::double precision / 60)`;
  const result = await db.execute(sql`
    insert into rate_limit_bucket (key, tokens, updated_at)
    values (${key}, ${capacity}::double precision - 1, now())
    on conflict (key) do update
      set tokens = ${refilled} - 1, updated_at = now()
      where ${refilled} >= 1
    returning tokens
  `);
  return result.rows.length > 0;
}
