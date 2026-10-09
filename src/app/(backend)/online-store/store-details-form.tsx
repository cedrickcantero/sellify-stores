"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input } from "@/ui";
import { saveStoreDetailsAction, type StoreFormState } from "./actions";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type LocalErrors = { name?: string; logo?: string };

// Store name and logo, saved to the draft. The name is checked first; then
// a chosen logo is uploaded to /api/uploads/logo and only its URL is sent
// to the save action.
export function StoreDetailsForm({ name: savedName, logoUrl }: { name: string; logoUrl?: string }) {
  const [state, save, saving] = useActionState<StoreFormState, FormData>(saveStoreDetailsAction, {});
  const [name, setName] = useState(savedName);
  const [local, setLocal] = useState<LocalErrors>({});
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const busy = saving || uploading;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.namedItem("logo") as HTMLInputElement | null;
    const trimmed = name.trim();
    if (!trimmed) return setLocal({ name: "Enter a store name." });
    if (trimmed.length > 80) return setLocal({ name: "Use 80 characters or fewer for the store name." });

    const file = fileInput?.files?.[0];
    let uploadedUrl: string | undefined;
    if (file) {
      if (file.size > MAX_LOGO_BYTES) return setLocal({ logo: "Choose a logo under 2 MB." });
      setUploading(true);
      try {
        const body = new FormData();
        body.set("logo", file);
        const response = await fetch("/api/uploads/logo", { method: "POST", body });
        const json = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!response.ok || !json?.url) {
          return setLocal({ logo: json?.error ?? "Could not upload that logo. Try again." });
        }
        uploadedUrl = json.url;
      } catch {
        return setLocal({ logo: "Could not upload that logo. Check your connection and try again." });
      } finally {
        setUploading(false);
      }
    }

    setLocal({});
    const form = new FormData();
    form.set("name", trimmed);
    if (uploadedUrl) form.set("logoUrl", uploadedUrl);
    if (fileInput) fileInput.value = "";
    startTransition(() => save(form));
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card
        title="Store details"
        description="Your store name and logo appear at the top of every store page."
        footer={
          <Button type="submit" variant="secondary" disabled={busy} className="w-full sm:w-auto">
            {uploading ? "Uploading logo..." : saving ? "Saving..." : "Save details"}
          </Button>
        }
      >
        <Field label="Store name" error={local.name ?? state.errors?.["brand.name"]}>
          <Input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            autoComplete="organization"
          />
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
            error={local.logo ?? state.errors?.["brand.logoUrl"]}
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
        {state.message && !local.name && !local.logo ? <Alert tone="success">{state.message}</Alert> : null}
      </Card>
    </form>
  );
}
