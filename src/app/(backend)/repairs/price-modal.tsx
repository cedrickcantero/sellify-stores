"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Modal, ModalClose, Select, type SelectOption } from "@/ui";
import { saveRepairPriceAction } from "./actions";

export type PriceDraft = {
  deviceModelId: string;
  repairTypeId: string;
  /** Euros, for example "89.00". */
  price: string;
  partQty: string;
};

// Adds or edits one price. When editing, the model and repair type are fixed.
export function PriceModal({
  models,
  repairTypes,
  initial,
  triggerLabel,
  primary,
}: {
  models: SelectOption[];
  repairTypes: SelectOption[];
  initial?: PriceDraft;
  triggerLabel: string;
  primary?: boolean;
}) {
  const editing = Boolean(initial);
  const empty: PriceDraft = { deviceModelId: "", repairTypeId: "", price: "", partQty: "0" };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PriceDraft>(initial ?? empty);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const result = await saveRepairPriceAction(draft);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(initial ?? empty);
          setError(undefined);
        }
      }}
      trigger={
        <Button variant={primary ? "primary" : "ghost"} size={primary ? "md" : "sm"}>
          {triggerLabel}
        </Button>
      }
      title={editing ? "Edit repair price" : "Add repair price"}
      description="Customers see this price when they book online."
      footer={
        <>
          <ModalClose asChild>
            <Button variant="secondary">Cancel</Button>
          </ModalClose>
          <Button type="submit" form="repair-price-form" disabled={pending}>
            Save price
          </Button>
        </>
      }
    >
      <form
        id="repair-price-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Model">
          <Select
            options={models}
            placeholder="Choose model"
            value={draft.deviceModelId}
            disabled={editing}
            onValueChange={(deviceModelId) => setDraft({ ...draft, deviceModelId })}
          />
        </Field>
        <Field label="Repair type">
          <Select
            options={repairTypes}
            placeholder="Choose repair type"
            value={draft.repairTypeId}
            disabled={editing}
            onValueChange={(repairTypeId) => setDraft({ ...draft, repairTypeId })}
          />
        </Field>
        <Field label="Price (EUR)" error={error}>
          <Input
            inputMode="decimal"
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            required
          />
        </Field>
        <Field label="Parts in stock" hint="Above 0 shows the same-day repair badge in your store.">
          <Input
            inputMode="numeric"
            value={draft.partQty}
            onChange={(event) => setDraft({ ...draft, partQty: event.target.value })}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
