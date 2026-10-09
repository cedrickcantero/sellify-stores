"use client";

import { useActionState, useState } from "react";
import { storeButtonClass, storeControlClass } from "@/store-ui/form-controls";
import { ErrorSummary } from "@/store-ui/error-summary";
import { HoneypotField } from "@/store-ui/honeypot-field";
import { acceptOffer, type SellFormState } from "../../actions";

const IDLE: SellFormState = { status: "idle" };

const FIELDS = [
  { name: "name", label: "Your name", type: "text", autoComplete: "name" },
  { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
] as const;

// Name, phone and email. Handover is fixed to dropping in to the shop. Only
// the quote id is sent; the price comes from the server.
export function AcceptForm({ slug, quoteId }: { slug: string; quoteId: string }) {
  const [state, action, pending] = useActionState(acceptOffer, IDLE);
  const errors = state.fieldErrors ?? {};
  // Controlled, so a rejected submit does not wipe what was typed.
  const [values, setValues] = useState<Record<string, string>>({ name: "", phone: "", email: "" });

  return (
    <form action={action} className="flex max-w-xl flex-col gap-5" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <HoneypotField />

      <ErrorSummary message={state.message} errors={Object.values(errors)} />

      {FIELDS.map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <label htmlFor={`accept-${field.name}`} className="font-semibold">
            {field.label}
          </label>
          <input
            id={`accept-${field.name}`}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            required
            value={values[field.name]}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            className={storeControlClass}
            aria-invalid={errors[field.name] ? true : undefined}
            aria-describedby={errors[field.name] ? `accept-${field.name}-error` : undefined}
          />
          {errors[field.name] ? (
            <p id={`accept-${field.name}-error`} className="text-sm font-semibold">
              {errors[field.name]}
            </p>
          ) : null}
        </div>
      ))}

      <p className="rounded-(--store-radius) border border-(--store-text)/30 p-3">
        <span className="font-semibold">Handover:</span> Drop in to the shop
      </p>

      <button type="submit" className={`${storeButtonClass} self-start`} disabled={pending}>
        {pending ? "Accepting..." : "Accept offer"}
      </button>
    </form>
  );
}
