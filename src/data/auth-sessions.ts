import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { member, session } from "./schema";

// Helpers Better Auth hooks and the sign-up use case need to keep the
// session's active organization (the active shop) set.

export async function firstOrganizationIdForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

export async function setSessionActiveOrganization(
  sessionToken: string,
  organizationId: string,
): Promise<void> {
  await db
    .update(session)
    .set({ activeOrganizationId: organizationId })
    .where(eq(session.token, sessionToken));
}
