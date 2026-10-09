import { ageRateLimitBucket } from "@/data/maintenance";

// Makes a rate limit bucket look `hours` old, in the test database only.
export async function ageBucket(key: string, hours: number): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("ageBucket runs only in integration tests");
  await ageRateLimitBucket(url, key, hours);
}
