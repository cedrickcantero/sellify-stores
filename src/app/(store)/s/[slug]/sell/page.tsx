import { forShop } from "@/data";
import { requireLiveStore } from "../store-context";
import { SellForm } from "./sell-form";

export default async function StoreSellPage({ params }: PageProps<"/s/[slug]/sell">) {
  const { slug } = await params;
  const { shopId } = await requireLiveStore(slug, "sell");
  const brands = await forShop(shopId).buybacks.offeredModels();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-(family-name:--store-font-heading) text-3xl font-bold">Sell your phone</h1>
        <p className="max-w-xl text-(--store-text)/80">
          Tell us about your phone and see your offer straight away. Happy with it? Drop in to the shop and we pay you.
        </p>
      </div>
      {brands.length === 0 ? (
        <p>We are not buying phones online right now. Check back soon, or visit us in the shop.</p>
      ) : (
        <SellForm slug={slug} brands={brands} />
      )}
    </div>
  );
}
