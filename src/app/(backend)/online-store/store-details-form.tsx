"use client";

import { useActionState } from "react";
import { Alert, Button, Card, Field, Input } from "@/ui";
import { saveStoreDetailsAction, type StoreFormState } from "./actions";

// Store name and logo, saved to the draft.
export function StoreDetailsForm({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [state, save, saving] = useActionState<StoreFormState, FormData>(saveStoreDetailsAction, {});

  return (
    <form action={save}>
      <Card
        title="Store details"
        description="Your store name and logo appear at the top of every store page."
        footer={
          <Button type="submit" variant="secondary" disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save details"}
          </Button>
        }
      >
        <Field label="Store name" error={state.errors?.["brand.name"]}>
          <Input name="name" defaultValue={name} maxLength={80} required autoComplete="organization" />
        </Field>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {logoUrl ? (
            // Logos are rendered only through <img>.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Current logo"
              className="h-16 w-auto max-w-40 rounded-control border border-border bg-surface object-contain p-2"
            />
          ) : null}
          <Field
            label={logoUrl ? "Replace logo" : "Logo"}
            hint="PNG, JPEG, GIF, WebP or SVG, up to 2 MB."
            error={state.errors?.["brand.logoUrl"]}
            className="flex-1"
          >
            <Input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="py-1.5"
            />
          </Field>
        </div>
        {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      </Card>
    </form>
  );
}
