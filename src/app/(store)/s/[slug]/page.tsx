import { StoreHome } from "@/store-ui";
import { requireLiveStore } from "./store-context";

// Store home page: name, enabled tabs, about text and opening hours from the
// store's config (the draft in a preview).
export default async function StoreHomePage({ params }: PageProps<"/s/[slug]">) {
  const { storefront, basePath, preview } = await requireLiveStore((await params).slug);
  return <StoreHome config={storefront.config} basePath={basePath} preview={preview} />;
}
