import { setSaleCreatedAt } from "@/data/maintenance";

// Moves a sale to a chosen moment. Integration tests only.
export async function backdateSale(saleId: string, createdAt: Date): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("backdateSale runs only in integration tests");
  await setSaleCreatedAt(url, saleId, createdAt);
}
