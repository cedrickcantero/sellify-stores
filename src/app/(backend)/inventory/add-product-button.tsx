"use client";

import { Button, type SelectOption } from "@/ui";
import { ProductFormModal, type PhotoUploadConfig } from "./product-form-modal";

export function AddProductButton({
  models,
  photos,
}: {
  models: SelectOption[];
  photos: PhotoUploadConfig;
}) {
  return <ProductFormModal models={models} photos={photos} trigger={<Button>Add product</Button>} />;
}
