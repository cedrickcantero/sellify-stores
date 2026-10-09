import type { Metadata } from "next";
import { getActiveShop } from "@/auth/session";
import { forShop } from "@/data";
import { PageHeader } from "@/ui";
import { PosRegister } from "./pos-register";

export const metadata: Metadata = { title: "POS | Sellify" };

export default async function PosPage() {
  const { shopId } = await getActiveShop();
  const products = await forShop(shopId).products.list({ stock: "in" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="POS" description="Ring up an in-shop sale." />
      <PosRegister
        products={products.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          stockQty: p.stockQty,
        }))}
      />
    </div>
  );
}
