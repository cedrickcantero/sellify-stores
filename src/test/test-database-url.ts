// Integration tests truncate tables between tests, so they must never touch
// the development or production database. Two independent checks protect it:
//
// 1. Here: TEST_DATABASE_URL must be set and name a different database from
//    DATABASE_URL, compared by host (Neon's "-pooler" suffix stripped), port
//    and database name rather than as raw strings.
// 2. In the data module: every truncate first checks that the database holds
//    the test marker table, created once by `pnpm db:mark-test-database`.

function parse(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol.startsWith("postgres") ? parsed : null;
  } catch {
    return null;
  }
}

// host:port/dbname, ignoring credentials, query options and the Neon pooler
// suffix, so two spellings of one database compare equal.
export function databaseKey(url: string): string {
  const parsed = parse(url);
  if (!parsed) throw new Error("Not a valid Postgres connection URL");
  const host = parsed.hostname.toLowerCase().replace(/-pooler(?=\.|$)/, "");
  const port = parsed.port || "5432";
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || parsed.username;
  return `${host}:${port}/${database}`;
}

export function testDatabaseUrl(env: Record<string, string | undefined>): string {
  const testUrl = env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    throw new Error(
      "Refusing to run integration tests: TEST_DATABASE_URL is not set. Point it at a dedicated Neon test branch.",
    );
  }
  if (!parse(testUrl)) {
    throw new Error("Refusing to run integration tests: TEST_DATABASE_URL is not a valid Postgres URL.");
  }
  const mainUrl = env.DATABASE_URL?.trim();
  if (mainUrl && (!parse(mainUrl) || databaseKey(mainUrl) === databaseKey(testUrl))) {
    throw new Error(
      "Refusing to run integration tests: TEST_DATABASE_URL must differ from DATABASE_URL (a different Neon branch, host or database).",
    );
  }
  return testUrl;
}
