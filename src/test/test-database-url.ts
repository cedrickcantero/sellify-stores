// Integration tests truncate tables between tests, so they must never touch
// the development or production database. This returns the dedicated test
// database URL, or throws when it is missing or equals DATABASE_URL.
export function testDatabaseUrl(env: Record<string, string | undefined>): string {
  const testUrl = env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    throw new Error(
      "Refusing to run integration tests: TEST_DATABASE_URL is not set. Point it at a dedicated Neon test branch.",
    );
  }
  if (testUrl === env.DATABASE_URL?.trim()) {
    throw new Error(
      "Refusing to run integration tests: TEST_DATABASE_URL must differ from DATABASE_URL.",
    );
  }
  return testUrl;
}
