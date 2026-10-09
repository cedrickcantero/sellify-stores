"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Modal, ModalClose, Select } from "@/ui";
import { saveBasePrice, type FormState } from "./actions";

export type ModelOption = { id: string; label: string; storageOptions: string[] };

const IDLE: FormState = { status: "idle" };

export function PriceForm({ models }: { models: ModelOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const next = await saveBasePrice(previous, formData);
      if (next.status === "saved") setOpen(false);
      return next;
    },
    IDLE,
  );
  const [modelId, setModelId] = useState("");
  const model = models.find((m) => m.id === modelId);


  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
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
        {state.status === "error" && state.message ? (
          <Alert tone="error">{state.message}</Alert>
        ) : null}
        <Field label="Model" error={state.fieldErrors?.deviceModelId}>
          <Select
            name="deviceModelId"
            placeholder="Choose a model"
            value={modelId}
            onValueChange={setModelId}
            options={models.map((m) => ({ value: m.id, label: m.label }))}
          />
        </Field>
        <Field label="Storage" error={state.fieldErrors?.storage}>
          <Select
            key={modelId}
            name="storage"
            placeholder={model ? "Choose a storage size" : "Choose a model first"}
            disabled={!model}
            options={(model?.storageOptions ?? []).map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Base price (EUR)" error={state.fieldErrors?.basePrice}>
          <Input name="basePrice" inputMode="decimal" placeholder="250.00" />
        </Field>
      </form>
    </Modal>
  );
}
