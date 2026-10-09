"use client";

import { Button, type SelectOption } from "@/ui";
import { ProductFormModal } from "./product-form-modal";

export function AddProductButton({ models }: { models: SelectOption[] }) {
  return <ProductFormModal models={models} trigger={<Button>Add product</Button>} />;
}
