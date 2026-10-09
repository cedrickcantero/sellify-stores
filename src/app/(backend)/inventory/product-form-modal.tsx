"use client";

import { useActionState, useEffect, useState } from "react";
import {
  CONDITION_LABELS,
  KIND_LABELS,
  PRODUCT_CONDITIONS,
  PRODUCT_KINDS,
} from "@/domain/product";
import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  ModalClose,
  Select,
  type SelectOption,
} from "@/ui";
import { saveProductAction, type ProductFormState } from "./actions";

export type EditableProduct = {
  id: string;
  title: string;
  kind: string;
  condition: string;
  /** Price in euros as typed, for example "349.50". */
  price: string;
  stockQty: number;
  images: string[];
  deviceModelId?: string;
};

const FORM_ID = "product-form";

const kindOptions: SelectOption[] = PRODUCT_KINDS.map((value) => ({
  value,
  label: KIND_LABELS[value],
}));
const conditionOptions: SelectOption[] = PRODUCT_CONDITIONS.map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}));

/**
 * Create (no `product`) or edit (with `product`) in a Modal. The form lives
 * inside the modal's content so it starts fresh every time the modal opens.
 */
export function ProductFormModal({
  product,
  models,
  open,
  onOpenChange,
  trigger,
}: {
  product?: EditableProduct;
  models: SelectOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [pending, setPending] = useState(false);

  return (
    <Modal
      trigger={trigger}
      open={isOpen}
      onOpenChange={setOpen}
      title={product ? "Edit product" : "Add product"}
      description="Phones and accessories you sell in the shop and online."
      footer={
        <>
          <ModalClose asChild>
            <Button variant="secondary">Cancel</Button>
          </ModalClose>
          <Button type="submit" form={FORM_ID} disabled={pending}>
            {pending ? "Saving" : product ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      <ProductForm
        product={product}
        models={models}
        onSaved={() => setOpen(false)}
        onPending={setPending}
      />
    </Modal>
  );
}

function ProductForm({
  product,
  models,
  onSaved,
  onPending,
}: {
  product?: EditableProduct;
  models: SelectOption[];
  onSaved: () => void;
  onPending: (pending: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    saveProductAction,
    {},
  );
  const [removedImages, setRemovedImages] = useState<string[]>([]);

  useEffect(() => onPending(pending), [pending, onPending]);
  useEffect(() => {
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);

  const values = state.values;
  const startImages = state.keptImages ?? product?.images ?? [];
  const keptImages = startImages.filter((url) => !removedImages.includes(url));

  return (
    <form id={FORM_ID} action={formAction} className="flex flex-col gap-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.form ? <Alert tone="error">{state.form}</Alert> : null}
      <Field label="Title" error={state.fields?.title}>
        <Input
          name="title"
          defaultValue={values?.title ?? product?.title}
          placeholder="iPhone 13 128GB"
          maxLength={120}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind" error={state.fields?.kind}>
          <Select
            name="kind"
            options={kindOptions}
            defaultValue={values?.kind ?? product?.kind}
          />
        </Field>
        <Field label="Condition" error={state.fields?.condition}>
          <Select
            name="condition"
            options={conditionOptions}
            defaultValue={values?.condition ?? product?.condition}
          />
        </Field>
        <Field label="Price (€)" error={state.fields?.price}>
          <Input
            name="price"
            inputMode="decimal"
            defaultValue={values?.price ?? product?.price}
            placeholder="349.00"
          />
        </Field>
        <Field label="Stock" error={state.fields?.stockQty}>
          <Input
            name="stockQty"
            inputMode="numeric"
            defaultValue={values?.stockQty ?? product?.stockQty ?? 1}
          />
        </Field>
      </div>
      <Field label="Device model" hint="Optional. Links the product to a phone model.">
        <Select
          name="deviceModelId"
          options={[{ value: "none", label: "No device model" }, ...models]}
          defaultValue={values?.deviceModelId || product?.deviceModelId || "none"}
        />
      </Field>
      <Field
        label="Photos"
        hint="Up to 8 photos, 2 MB each. PNG, JPEG, GIF, WebP or SVG."
        error={state.fields?.images}
      >
        <Input name="photos" type="file" accept="image/*" multiple />
      </Field>
      {keptImages.length > 0 ? (
        <ul className="flex flex-wrap gap-3" aria-label="Current photos">
          {keptImages.map((url, index) => (
            <li key={url} className="flex flex-col items-start gap-1">
              {/* Blob URLs are public and served from Vercel's storage domain. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="size-16 rounded-control border border-border object-cover"
              />
              <input type="hidden" name="keptImage" value={url} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRemovedImages((list) => [...list, url])}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
