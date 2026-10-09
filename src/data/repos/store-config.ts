import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { storeConfig, storeConfigVersion } from "../schema";

// Configs are stored as JSON; the services layer validates them with the
// StoreConfig schema before every write and after every read.
export type StoredConfig = Record<string, unknown>;

export type StoreConfigRow = {
  draft: StoredConfig;
  published: StoredConfig | null;
  online: boolean;
};

export type StoreConfigVersion = {
  id: string;
  config: StoredConfig;
  publishedAt: Date;
  publishedBy: string | null;
};

export type StoreConfigRepo = {
  get(): Promise<StoreConfigRow | null>;
  saveDraft(draft: StoredConfig): Promise<void>;
  // Makes `config` the published config, sets the store online and appends
  // a version row, in one transaction.
  publish(config: StoredConfig, userId: string): Promise<void>;
  // Sets the online flag, creating the row with `draftIfMissing` when the
  // shop has none yet.
  setOnline(online: boolean, draftIfMissing: StoredConfig): Promise<void>;
  listVersions(): Promise<StoreConfigVersion[]>;
};

export function storeConfigRepo(shopId: string): StoreConfigRepo {
  return {
    async get() {
      const rows = await db
        .select({ draft: storeConfig.draft, published: storeConfig.published, online: storeConfig.online })
        .from(storeConfig)
        .where(eq(storeConfig.shopId, shopId))
        .limit(1);
      return rows[0] ?? null;
    },

    async saveDraft(draft) {
      await db
        .insert(storeConfig)
        .values({ shopId, draft })
        .onConflictDoUpdate({ target: storeConfig.shopId, set: { draft, updatedAt: new Date() } });
    },

    async publish(config, userId) {
      await db.transaction(async (tx) => {
        await tx
          .insert(storeConfig)
          .values({ shopId, draft: config, published: config, online: true })
          .onConflictDoUpdate({
            target: storeConfig.shopId,
            set: { published: config, online: true, updatedAt: new Date() },
          });
        await tx.insert(storeConfigVersion).values({ shopId, config, publishedBy: userId });
      });
    },

    async setOnline(online, draftIfMissing) {
      await db
        .insert(storeConfig)
        .values({ shopId, draft: draftIfMissing, online })
        .onConflictDoUpdate({ target: storeConfig.shopId, set: { online, updatedAt: new Date() } });
    },

    async listVersions() {
      return db
        .select({
          id: storeConfigVersion.id,
          config: storeConfigVersion.config,
          publishedAt: storeConfigVersion.publishedAt,
          publishedBy: storeConfigVersion.publishedBy,
        })
        .from(storeConfigVersion)
        .where(eq(storeConfigVersion.shopId, shopId))
        .orderBy(desc(storeConfigVersion.publishedAt));
    },
  };
}
