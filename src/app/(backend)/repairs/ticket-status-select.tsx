"use client";

import { useState, useTransition } from "react";
import { Field, Select } from "@/ui";
import { setTicketStatusAction } from "./actions";

const OPTIONS = [
  { value: "booked", label: "Booked" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export function TicketStatusSelect({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Field label={<span className="sr-only">Change status</span>} error={error}>
      <Select
        options={OPTIONS}
        value={value}
        disabled={pending}
        className="h-8 w-40"
        onValueChange={(next) => {
          const previous = value;
          setValue(next);
          start(async () => {
            const result = await setTicketStatusAction({
              ticketId,
              status: next,
            });
            if (result.error) {
              setValue(previous);
              setError(result.error);
            } else {
              setError(undefined);
            }
          });
        }}
      />
    </Field>
  );
}
