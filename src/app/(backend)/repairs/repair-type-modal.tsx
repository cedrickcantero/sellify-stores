"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Modal, ModalClose } from "@/ui";
import { createRepairTypeAction } from "./actions";

export function RepairTypeModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function save(form: HTMLFormElement) {
    const name = String(new FormData(form).get("name") ?? "");
    start(async () => {
      const result = await createRepairTypeAction({ name });
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
      trigger={<Button variant="secondary">Add repair type</Button>}
      title="Add repair type"
      description="Name a repair you offer, such as Screen or Battery."
      footer={
        <>
          <ModalClose asChild>
            <Button variant="secondary">Cancel</Button>
          </ModalClose>
          <Button type="submit" form="repair-type-form" disabled={pending}>
            Save repair type
          </Button>
        </>
      }
    >
      <form
        id="repair-type-form"
        onSubmit={(event) => {
          event.preventDefault();
          save(event.currentTarget);
        }}
      >
        <Field label="Name" error={error}>
          <Input name="name" placeholder="Screen" maxLength={60} required />
        </Field>
      </form>
    </Modal>
  );
}
