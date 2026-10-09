import { and, desc, eq } from "drizzle-orm";
import type { EmailKind } from "@/domain/email";
import { db } from "../db";
import { emailOutbox } from "../schema";

const LIST_LIMIT = 200;

export type OutboxEmail = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  kind: EmailKind;
  status: "pending" | "sent" | "failed";
  error: string | null;
  createdAt: Date;
};

export type EmailOutboxRepo = {
  /** Records an email as pending and returns its id. */
  record(msg: { to: string; subject: string; html: string; kind: EmailKind }): Promise<string>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  /** The shop's newest emails, newest first (default 200). */
  list(limit?: number): Promise<OutboxEmail[]>;
};

export function emailOutboxRepo(shopId: string): EmailOutboxRepo {
  const mine = (id: string) => and(eq(emailOutbox.shopId, shopId), eq(emailOutbox.id, id));
  return {
    async record(msg) {
      const [row] = await db
        .insert(emailOutbox)
        .values({
          shopId,
          recipient: msg.to,
          subject: msg.subject,
          body: msg.html,
          kind: msg.kind,
        })
        .returning({ id: emailOutbox.id });
      return row.id;
    },
    async markSent(id) {
      await db.update(emailOutbox).set({ status: "sent", error: null }).where(mine(id));
    },
    async markFailed(id, error) {
      await db.update(emailOutbox).set({ status: "failed", error }).where(mine(id));
    },
    async list(limit = LIST_LIMIT) {
      return db
        .select({
          id: emailOutbox.id,
          recipient: emailOutbox.recipient,
          subject: emailOutbox.subject,
          body: emailOutbox.body,
          kind: emailOutbox.kind,
          status: emailOutbox.status,
          error: emailOutbox.error,
          createdAt: emailOutbox.createdAt,
        })
        .from(emailOutbox)
        .where(eq(emailOutbox.shopId, shopId))
        .orderBy(desc(emailOutbox.createdAt))
        .limit(limit);
    },
  };
}
