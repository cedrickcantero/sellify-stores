"use client";

import { useActionState } from "react";
import { Button, Modal, ModalClose } from "@/ui";
import { markQuoteReceived, removeBasePrice, type ReceivedState } from "./actions";

export function MarkReceivedButton({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState<ReceivedState, FormData>(markQuoteReceived, {});
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="quoteId" value={quoteId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Mark received
      </Button>
      {state.message ? (
        <p role="alert" className="text-small text-error-text">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function RemovePriceButton({
  deviceModelId,
  storage,
  label,
}: {
  deviceModelId: string;
  storage: string;
  label: string;
}) {
  return (
    <Modal
      size="sm"
      title="Remove price?"
      description={`You will stop buying ${label}, ${storage}. Customers will no longer get an offer for it.`}
      trigger={
        <Button variant="ghost" size="sm">
          Remove
        </Button>
      }
      footer={
        <>
          <ModalClose asChild>
            <Button variant="secondary">Cancel</Button>
          </ModalClose>
          <Button type="submit" variant="destructive" form={`remove-${deviceModelId}-${storage}`}>
            Remove price
          </Button>
        </>
      }
    >
      <form id={`remove-${deviceModelId}-${storage}`} action={removeBasePrice}>
        <input type="hidden" name="deviceModelId" value={deviceModelId} />
        <input type="hidden" name="storage" value={storage} />
      </form>
    </Modal>
  );
}
