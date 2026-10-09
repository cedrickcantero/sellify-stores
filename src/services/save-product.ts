import "server-only";
import { deviceCatalog, forShop, type Product } from "@/data";
import {
  parseProductForm,
  type ProductFieldErrors,
  type ProductFormValues,
} from "@/domain/product";
import { err, ok, type Result } from "@/domain/result";
import { isShopImageUrl } from "@/domain/shop-image-url";

export type SaveProductError = { fields?: ProductFieldErrors; form?: string };

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

  if (!checked.value.images.every((url) => isShopImageUrl(url, shopId))) {
    return err({ fields: { images: "One photo link is not valid. Add that photo again." } });
  }

  const modelId = checked.value.deviceModelId;
  if (modelId && !(await deviceCatalog.list()).some((model) => model.id === modelId)) {
    return err({ fields: { deviceModelId: "Choose a device model from the list." } });
  }

  const products = forShop(shopId).products;
  if (!input.id) return ok(await products.create(checked.value));

  if (input.expectedStockQty === undefined) {
    return err({ form: "Stock changed since you opened this. Reopen to edit." });
  }
  const updated = await products.update(input.id, checked.value, input.expectedStockQty);
  if (updated.ok) return ok(updated.product);
  return err({
    form:
      updated.reason === "stock_changed"
        ? "Stock changed since you opened this. Reopen to edit."
        : "That product no longer exists.",
  });
}
