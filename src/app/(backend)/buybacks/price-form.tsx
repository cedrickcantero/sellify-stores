"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Modal, ModalClose, Select } from "@/ui";
import { saveBasePrice, type FormState } from "./actions";

export type ModelOption = { id: string; label: string; storageOptions: string[] };

const IDLE: FormState = { status: "idle" };

export function PriceForm({ models }: { models: ModelOption[] }) {
  const [open, setOpen] = useState(false);
  // The fields are controlled, so a failed save keeps what was typed.
  const [modelId, setModelId] = useState("");
  const [storage, setStorage] = useState("");
  const [basePrice, setBasePrice] = useState("");
  // Errors belong to the attempt that produced them; closing hides them.
  const [hiddenState, setHiddenState] = useState<FormState | null>(null);

  const [state, action, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const next = await saveBasePrice(previous, formData);
      if (next.status === "saved") setOpen(false);
      return next;
    },
    IDLE,
  );
  const shown = state === hiddenState ? IDLE : state;
  const model = models.find((m) => m.id === modelId);

  function onOpenChange(next: boolean) {
    setOpen(next);
    setHiddenState(state);
    if (next) {
      setModelId("");
      setStorage("");
      setBasePrice("");
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Set base price"
      description="What you pay for this model and storage size before any deduction."
      trigger={<Button variant="secondary">Set base price</Button>}
      footer={
        <>
          <ModalClose asChild>
            <Button variant="secondary">Cancel</Button>
          </ModalClose>
          <Button type="submit" form="base-price-form" disabled={pending}>
            Save price
          </Button>
        </>
      }
    >
      <form id="base-price-form" action={action} className="flex flex-col gap-4">
        {shown.status === "error" && shown.message ? (
          <Alert tone="error">{shown.message}</Alert>
        ) : null}
        <Field label="Model" error={shown.fieldErrors?.deviceModelId}>
          <Select
            name="deviceModelId"
            placeholder="Choose a model"
            value={modelId}
            onValueChange={(value) => {
              setModelId(value);
              setStorage("");
            }}
            options={models.map((m) => ({ value: m.id, label: m.label }))}
          />
        </Field>
        <Field label="Storage" error={shown.fieldErrors?.storage}>
          <Select
            key={modelId}
            name="storage"
            placeholder={model ? "Choose a storage size" : "Choose a model first"}
            disabled={!model}
            value={storage}
            onValueChange={setStorage}
            options={(model?.storageOptions ?? []).map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Base price (EUR)" error={shown.fieldErrors?.basePrice}>
          <Input
            name="basePrice"
            inputMode="decimal"
            placeholder="250.00"
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
