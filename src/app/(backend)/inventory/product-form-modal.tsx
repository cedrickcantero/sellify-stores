"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useEffect, useState } from "react";
import {
  CONDITION_LABELS,
  KIND_LABELS,
  MAX_PRODUCT_IMAGES,
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
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

// What the page knows that the form needs besides the product itself.
export type PhotoUploadConfig = {
  /** The shop's folder in Blob storage is images/<shopId>/. */
  shopId: string;
  /** False when no Blob token is set up. */
  configured: boolean;
};

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
  photos,
  open,
  onOpenChange,
  trigger,
}: {
  product?: EditableProduct;
  models: SelectOption[];
  photos: PhotoUploadConfig;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

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
          <Button type="submit" form={FORM_ID} disabled={pending || uploading}>
            {pending ? "Saving" : product ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      <ProductForm
        product={product}
        models={models}
        photos={photos}
        onSaved={() => setOpen(false)}
        onPending={setPending}
        onUploading={setUploading}
      />
    </Modal>
  );
}

function ProductForm({
  product,
  models,
  photos,
  onSaved,
  onPending,
  onUploading,
}: {
  product?: EditableProduct;
  models: SelectOption[];
  photos: PhotoUploadConfig;
  onSaved: () => void;
  onPending: (pending: boolean) => void;
  onUploading: (uploading: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    saveProductAction,
    {},
  );
  // Photos are uploaded straight from the browser as soon as they are chosen;
  // the form then posts only their URLs. They live in state, so they survive
  // a validation error.
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string>();

  useEffect(() => onPending(pending), [pending, onPending]);
  useEffect(() => onUploading(uploading), [uploading, onUploading]);
  useEffect(() => {
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);

  async function addPhotos(files: File[]) {
    setPhotoError(undefined);
    if (images.length + files.length > MAX_PRODUCT_IMAGES) {
      setPhotoError(`Add up to ${MAX_PRODUCT_IMAGES} photos.`);
      return;
    }
    for (const file of files) {
      const extension = PHOTO_EXTENSIONS[file.type];
      if (!extension) {
        setPhotoError(`${file.name} is not a supported photo. Use a PNG, JPEG, GIF or WebP.`);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(`${file.name} is over 2 MB. Choose a smaller photo.`);
        return;
      }
    }
    setUploading(true);
    try {
      for (const file of files) {
        const blob = await upload(
          `images/${photos.shopId}/${crypto.randomUUID()}.${PHOTO_EXTENSIONS[file.type]}`,
          file,
          { access: "public", handleUploadUrl: "/api/blob/product-photo" },
        );
        setImages((list) => [...list, blob.url]);
      }
    } catch {
      setPhotoError("We could not upload that photo. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const values = state.values;

  return (
    <form id={FORM_ID} action={formAction} className="flex flex-col gap-4">
      {product ? (
        <>
          <input type="hidden" name="id" value={product.id} />
          {/* The stock this form opened with. The save is refused if it has moved. */}
          <input type="hidden" name="expectedStockQty" value={product.stockQty} />
        </>
      ) : null}
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
      <Field
        label="Device model"
        hint="Optional. Links the product to a phone model."
        error={state.fields?.deviceModelId}
      >
        <Select
          name="deviceModelId"
          options={[{ value: "none", label: "No device model" }, ...models]}
          defaultValue={values?.deviceModelId || product?.deviceModelId || "none"}
        />
      </Field>
      <Field
        label="Photos"
        hint={
          photos.configured
            ? uploading
              ? "Uploading."
              : "Up to 8 photos, 2 MB each. PNG, JPEG, GIF or WebP."
            : "Photo upload is not set up yet."
        }
        error={photoError ?? state.fields?.images}
      >
        <Input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          disabled={!photos.configured || uploading}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void addPhotos(files);
          }}
        />
      </Field>
      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-3" aria-label="Photos">
          {images.map((url, index) => (
            <li key={url} className="flex flex-col items-start gap-1">
              {/* Blob URLs are public and served from Vercel's storage domain. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="size-16 rounded-control border border-border object-cover"
              />
              <input type="hidden" name="image" value={url} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImages((list) => list.filter((item) => item !== url))}
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
