import type { Metadata } from "next";
import { getActiveShop } from "@/auth/session";
import { forShop } from "@/data";
import { signOutAction } from "../../(auth)/actions";

export const metadata: Metadata = { title: "Dashboard | Sellify" };

// Empty authenticated backend page. The dashboard content and the backend
// shell come in later tickets.
export default async function DashboardPage() {
  const { shopId } = await getActiveShop();
  const shop = await forShop(shopId).shop.get();

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{shop?.name}</h1>
        <form action={signOutAction}>
          <button type="submit" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
            Log out
          </button>
        </form>
      </div>
      <p className="text-neutral-600">Your shop dashboard is ready.</p>
    </main>
  );
}
