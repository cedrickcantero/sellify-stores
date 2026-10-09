"use server";

import { revalidatePath } from "next/cache";
import { getActiveShop } from "@/auth/session";
import type { FieldErrors } from "@/domain/store-config";
import { publishStore, saveDraft, setStoreOnline } from "@/services/store";
import { uploadImage } from "@/services/upload-image";

export type StoreFormState = { errors?: FieldErrors; error?: string; message?: string };

const UPLOAD_ERRORS = {
  too_large: "Choose a logo under 2 MB.",
  bad_type: "Choose a PNG, JPEG, GIF, WebP or SVG logo.",
} as const;

// Store name and logo. The logo, when chosen, is uploaded first; both are
// saved to the draft, which customers see only after Publish.
export async function saveStoreDetailsAction(_prev: StoreFormState, form: FormData): Promise<StoreFormState> {
  const { shopId } = await getActiveShop();
  const name = form.get("name");
  const logo = form.get("logo");

  let logoUrl: string | undefined;
  if (logo instanceof File && logo.size > 0) {
    const uploaded = await uploadImage(shopId, logo);
    if (!uploaded.ok) return { errors: { "brand.logoUrl": UPLOAD_ERRORS[uploaded.error] } };
    logoUrl = uploaded.value.url;
  }

  const saved = await saveDraft(shopId, {
    brand: { name: typeof name === "string" ? name : "", ...(logoUrl ? { logoUrl } : {}) },
  });
  if (!saved.ok) return { errors: saved.error };
  revalidatePath("/online-store");
  return { message: "Details saved. Publish to show them in your store." };
}

export async function publishStoreAction(): Promise<StoreFormState> {
  const { shopId, userId } = await getActiveShop();
  const published = await publishStore(shopId, userId);
  revalidatePath("/online-store");
  if (!published.ok) {
    return { error: "Fix the highlighted store settings, then publish again.", errors: published.error };
  }
  return { message: "Store published. It is live at your store address." };
}

export async function setStoreOnlineAction(online: boolean): Promise<void> {
  const { shopId } = await getActiveShop();
  await setStoreOnline(shopId, online === true);
  revalidatePath("/online-store");
}
