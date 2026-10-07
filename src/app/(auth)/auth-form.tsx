"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@/ui";
import type { AuthFormState } from "./actions";

export type AuthField = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  minLength?: number;
};

// The sign-up and login form, built from the shared ui components.
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
        <Field key={field.name} label={field.label}>
          <Input
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            minLength={field.minLength}
            defaultValue={state.values?.[field.name]}
            required
          />
        </Field>
      ))}
      {state.error ? (
        <p
          role="alert"
          className="rounded-control border border-error bg-error-tint px-3 py-2 text-body text-error"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
