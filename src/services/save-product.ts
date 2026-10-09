import "server-only";
import { deviceCatalog, forShop, type Product } from "@/data";
import {
  parseProductForm,
  type ProductFieldErrors,
  type ProductFormValues,
} from "@/domain/product";
import { err, ok, type Result } from "@/domain/result";
import { blobHostForToken, isShopImageUrl } from "@/domain/shop-image-url";

// stockChanged marks the refusal of an edit made against stale stock, so the
// caller can refresh the list and close the form.
export type SaveProductError = {
  fields?: ProductFieldErrors;
  form?: string;
  stockChanged?: true;
};

const STOCK_CHANGED = "Stock changed since you opened this. Check the new stock and edit again.";

// Creates a product, or edits it when `id` is given. `values` are the form's
// raw text fields. `imageUrls` are the product's photos, already uploaded
// from the browser to Blob; each must be a Blob URL under this shop's own
// images folder. An edit also carries `expectedStockQty`, the stock the form
// showed when it opened, and is refused if stock has moved since (a sale
// must never be overwritten). shopId must come from the server session.
export async function saveProduct(
  shopId: string,
  input: {
    id?: string;
    values: Omit<ProductFormValues, "images">;
    imageUrls: string[];
    expectedStockQty?: number;
  },
): Promise<Result<Product, SaveProductError>> {
  const checked = parseProductForm({ ...input.values, images: input.imageUrls });
  if (!checked.ok) return err({ fields: checked.error });

  const blobHost = blobHostForToken(process.env.BLOB_READ_WRITE_TOKEN);
  if (!checked.value.images.every((url) => isShopImageUrl(url, shopId, blobHost))) {
    return err({ fields: { images: "One photo link is not valid. Add that photo again." } });
  }

  const modelId = checked.value.deviceModelId;
  if (modelId && !(await deviceCatalog.list()).some((model) => model.id === modelId)) {
    return err({ fields: { deviceModelId: "Choose a device model from the list." } });
  }

  const products = forShop(shopId).products;
  if (!input.id) return ok(await products.create(checked.value));

  if (input.expectedStockQty === undefined) {
    return err({ form: STOCK_CHANGED, stockChanged: true });
  }
  const updated = await products.update(input.id, checked.value, input.expectedStockQty);
  if (updated.ok) return ok(updated.product);
  return err(
    updated.reason === "stock_changed"
      ? { form: STOCK_CHANGED, stockChanged: true }
      : { form: "That product no longer exists." },
  );
}
