import "server-only";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { account, invitation, member, organization, session, user, verification } from "./schema";

// Better Auth's database adapter lives in the data module so the auth module
// never touches the database client directly.
export const authDatabaseAdapter = drizzleAdapter(db, {
  provider: "pg",
  schema: { user, session, account, verification, organization, member, invitation },
});
