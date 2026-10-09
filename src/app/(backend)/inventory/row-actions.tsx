"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Modal, ModalClose, type SelectOption } from "@/ui";
import { removeProductAction } from "./actions";
import { ProductFormModal, type EditableProduct, type PhotoUploadConfig } from "./product-form-modal";

// Edit and Remove for one table row. Remove asks for confirmation first.
export function RowActions({
  product,
  models,
  photos,
}: {
  product: EditableProduct;
  models: SelectOption[];
  photos: PhotoUploadConfig;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await removeProductAction(product.id);
      if (result.error) setError(result.error);
      else setRemoving(false);
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setRemoving(true)}>
        Remove
      </Button>
      <ProductFormModal
        product={product}
        models={models}
        photos={photos}
        open={editing} onOpenChange={setEditing} />
      <Modal
        size="sm"
        open={removing}
        onOpenChange={(next) => {
          setRemoving(next);
          if (!next) setError(undefined);
        }}
        title="Remove product?"
        description={`${product.title} will be removed from your inventory and your online store.`}
        footer={
          <>
            <ModalClose asChild>
              <Button variant="secondary">Keep product</Button>
            </ModalClose>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending ? "Removing" : "Remove product"}
            </Button>
          </>
        }
      >
        {error ? <Alert tone="error">{error}</Alert> : null}
      </Modal>
    </div>
  );
}
