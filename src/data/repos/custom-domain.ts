import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { customDomain, type DnsRecordRow } from "../schema";

export type CustomDomainStatus = "pending" | "verified" | "error";

export type CustomDomain = {
  hostname: string;
  status: CustomDomainStatus;
  dnsRecords: DnsRecordRow[];
};

// The shop's custom domains. The connect and check flow (Vercel API) builds
// on these; store resolution uses resolveShopByVerifiedHostname instead.
export type CustomDomainRepo = {
  list(): Promise<CustomDomain[]>;
  // Hostnames are stored lower case and are unique across all shops.
  add(input: { hostname: string; status?: CustomDomainStatus; dnsRecords?: DnsRecordRow[] }): Promise<void>;
  setStatus(hostname: string, status: CustomDomainStatus, dnsRecords?: DnsRecordRow[]): Promise<boolean>;
  remove(hostname: string): Promise<boolean>;
};

export function customDomainRepo(shopId: string): CustomDomainRepo {
  return {
    async list() {
      return db
        .select({
          hostname: customDomain.hostname,
          status: customDomain.status,
          dnsRecords: customDomain.dnsRecords,
        })
        .from(customDomain)
        .where(eq(customDomain.shopId, shopId))
        .orderBy(asc(customDomain.createdAt));
    },

    async add({ hostname, status = "pending", dnsRecords = [] }) {
      await db.insert(customDomain).values({ shopId, hostname: hostname.toLowerCase(), status, dnsRecords });
    },

    async setStatus(hostname, status, dnsRecords) {
      const rows = await db
        .update(customDomain)
        .set(dnsRecords ? { status, dnsRecords } : { status })
        .where(and(eq(customDomain.shopId, shopId), eq(customDomain.hostname, hostname.toLowerCase())))
        .returning({ hostname: customDomain.hostname });
      return rows.length > 0;
    },

    async remove(hostname) {
      const rows = await db
        .delete(customDomain)
        .where(and(eq(customDomain.shopId, shopId), eq(customDomain.hostname, hostname.toLowerCase())))
        .returning({ hostname: customDomain.hostname });
      return rows.length > 0;
    },
  };
}
