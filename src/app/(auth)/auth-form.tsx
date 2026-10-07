"use client";

import { useActionState } from "react";
import type { AuthFormState } from "./actions";

export type AuthField = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  minLength?: number;
};

// Plain form for the sign-up and login pages. Styling is provisional; the
// shared ui components from the design system ticket replace it.
export function AuthForm({
  action,
  fields,
  submitLabel,
}: {
  action: (state: AuthFormState, form: FormData) => Promise<AuthFormState>;
  fields: AuthField[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-1 text-sm font-medium">
          {field.label}
          <input
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            minLength={field.minLength}
            defaultValue={state.values?.[field.name]}
            required
            className="rounded-lg border border-neutral-300 px-3 py-2 font-normal"
          />
        </label>
      ))}
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}
