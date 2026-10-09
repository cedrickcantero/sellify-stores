import { forShop } from "@/data";
import { bookingWindow } from "@/domain/repair-slots";
import { requireLiveStore } from "../store-context";
import { RepairBooking } from "./repair-booking";

export default async function StoreRepairPage({ params }: PageProps<"/s/[slug]/repair">) {
  const slug = (await params).slug;
  const { shopId } = await requireLiveStore(slug, "repair");
  const repos = forShop(shopId);
  const [brands, shop] = await Promise.all([repos.repairs.offeredModels(), repos.shop.get()]);
  const timezone = shop?.timezone ?? "UTC";
  const { first, last } = bookingWindow(new Date(), timezone);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-(family-name:--store-font-heading) text-3xl font-bold">Book a repair</h1>
      {brands.length === 0 ? (
        <p className="text-(--store-text)/75">This shop has not listed any repairs yet. Call or visit us in the shop.</p>
      ) : (
        <RepairBooking slug={slug} brands={brands} timezone={timezone} firstDate={first} lastDate={last} />
      )}
    </div>
  );
}
