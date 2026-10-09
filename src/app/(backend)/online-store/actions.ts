"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveShop } from "@/auth/session";
import type { FieldErrors } from "@/domain/store-config";
import { publishStore, saveDraft, setStoreOnline } from "@/services/store";

export type StoreFormState = {
  errors?: FieldErrors;
  error?: string;
  message?: string;
  /** What the owner typed, so the form keeps it after an error. */
  values?: { name: string };
};

// The logo file is uploaded first through POST /api/uploads/logo; this
// action receives only its URL. saveDraft checks the URL is this shop's
// upload on the project's Blob store.
const detailsInput = z.object({
  name: z.string().trim().min(1, "Enter a store name.").max(80, "Use 80 characters or fewer for the store name."),
  logoUrl: z.string().max(2048).optional(),
});

function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function saveStoreDetailsAction(_prev: StoreFormState, form: FormData): Promise<StoreFormState> {
  const { shopId } = await getActiveShop();
  const values = { name: text(form, "name") ?? "" };
  const parsed = detailsInput.safeParse({ name: values.name, logoUrl: text(form, "logoUrl") });
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === "name");
    return {
      values,
      errors: nameIssue ? { "brand.name": nameIssue.message } : { "brand.logoUrl": "Upload the logo again." },
    };
  }

  const { name, logoUrl } = parsed.data;
  const saved = await saveDraft(shopId, { brand: { name, ...(logoUrl ? { logoUrl } : {}) } });
  if (!saved.ok) return { values, errors: saved.error };
  revalidatePath("/online-store");
  return { values, message: "Details saved. Publish to show them in your store." };
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

const onlineInput = z.boolean();

export async function setStoreOnlineAction(online: unknown): Promise<{ ok: boolean }> {
  const { shopId } = await getActiveShop();
  const parsed = onlineInput.safeParse(online);
  if (!parsed.success) return { ok: false };
  await setStoreOnline(shopId, parsed.data);
  revalidatePath("/online-store");
  return { ok: true };
}
