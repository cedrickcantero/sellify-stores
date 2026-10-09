import "server-only";
import { forShop, type Product } from "@/data";
import {
  parseProductForm,
  type ProductFieldErrors,
  type ProductFormValues,
} from "@/domain/product";
import { err, ok, type Result } from "@/domain/result";
import { uploadImage } from "./upload-image";

export type SaveProductError = { fields?: ProductFieldErrors; form?: string };

// Creates a product, or edits it when `id` is given. `values` are the form's
// raw text fields; `keptImages` are the photo URLs the owner left on an
// edited product (only URLs the product already has are honoured); `files`
// are newly chosen photos, stored through uploadImage. Nothing is saved
// unless the whole form and every photo are good. shopId must come from the
// server session.
export async function saveProduct(
  shopId: string,
  input: {
    id?: string;
    values: Omit<ProductFormValues, "images">;
    keptImages: string[];
    files: File[];
  },
): Promise<Result<Product, SaveProductError>> {
  const products = forShop(shopId).products;

  let kept: string[] = [];
  if (input.id) {
    const existing = await products.get(input.id);
    if (!existing) return err({ form: "That product no longer exists." });
    kept = input.keptImages.filter((url) => existing.images.includes(url));
  }

  // An empty file input still submits one empty File; it is not a photo.
  const files = input.files.filter((file) => file.size > 0);

  // Validate with a placeholder per new photo so the photo limit counts them.
  const checked = parseProductForm({
    ...input.values,
    images: [...kept, ...files.map(() => "pending")],
  });
  if (!checked.ok) return err({ fields: checked.error });

  const uploaded: string[] = [];
  if (files.length > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return err({
        fields: {
          images: "Photo upload is not set up yet. Save without photos, or connect Blob storage.",
        },
      });
    }
    for (const file of files) {
      let result;
      try {
        result = await uploadImage(shopId, file);
      } catch {
        return err({ fields: { images: `We could not upload ${file.name}. Try again.` } });
      }
      if (!result.ok) {
        const messages = {
          too_large: `${file.name} is over 2 MB. Choose a smaller photo.`,
          bad_type: `${file.name} is not a photo. Use a PNG, JPEG, GIF, WebP or SVG.`,
        } as const;
        return err({ fields: { images: messages[result.error] } });
      }
      uploaded.push(result.value.url);
    }
  }

  const product = { ...checked.value, images: [...kept, ...uploaded] };
  if (!input.id) return ok(await products.create(product));

  const updated = await products.update(input.id, product);
  return updated ? ok(updated) : err({ form: "That product no longer exists." });
}
