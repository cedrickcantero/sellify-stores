"use client";

import { useState, useTransition } from "react";
import { Select } from "@/ui";
import { setTicketStatusAction } from "./actions";

const OPTIONS = [
  { value: "booked", label: "Booked" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export function TicketStatusSelect({ ticketId, status }: { ticketId: string; status: string }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <Select
      options={OPTIONS}
      value={value}
      disabled={pending}
      aria-label="Change status"
      className="h-8 w-40"
      onValueChange={(next) => {
        const previous = value;
        setValue(next);
        start(async () => {
          const result = await setTicketStatusAction({ ticketId, status: next });
          if (result.error) setValue(previous);
        });
      }}
    />
  );
}
