"use client";

import { useActionState } from "react";
import { MAX_LINE_QTY } from "@/domain/cart";

// Forms that talk to the basket actions. They show the action's message and
// disable the button while the request runs, so a double click adds once.
type BasketAction = (previous: { message?: string }, formData: FormData) => Promise<{ message?: string }>;

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-(--store-radius) bg-(--store-primary) px-5 font-semibold text-(--store-on-primary) hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary) disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-(--store-radius) border border-(--store-text)/40 px-4 font-semibold hover:bg-(--store-text)/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary) disabled:cursor-not-allowed disabled:opacity-50";

export function AddToBasketForm({
  action,
  soldOut,
  className = "",
}: {
  action: BasketAction;
  soldOut: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className}`}>
      <button type="submit" disabled={soldOut || pending} className={`${buttonClass} w-full`}>
        {soldOut ? "Sold out" : pending ? "Adding..." : "Add to basket"}
      </button>
      <p role="status" className="text-sm">
        {state.message}
      </p>
    </form>
  );
}

export function QuantityForm({
  action,
  qty,
  max,
}: {
  action: BasketAction;
  qty: number;
  max: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Quantity
          <input
            type="number"
            name="qty"
            defaultValue={qty}
            min={1}
            max={Math.min(max, MAX_LINE_QTY)}
            required
            inputMode="numeric"
            className="min-h-11 w-20 rounded-(--store-radius) border border-(--store-text)/40 bg-transparent px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary)"
          />
        </label>
        <button type="submit" disabled={pending} className={secondaryClass}>
          {pending ? "Updating..." : "Update"}
        </button>
      </div>
      <p role="status" className="text-sm">
        {state.message}
      </p>
    </form>
  );
}
