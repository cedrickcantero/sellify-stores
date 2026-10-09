"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Alert, Button, Card, StatusBadge, Switch } from "@/ui";
import { publishStoreAction, setStoreOnlineAction, type StoreFormState } from "./actions";

// Store status, live address, the online switch and the Publish button.
export function StoreStatusCard({
  address,
  published,
  online,
}: {
  address: string;
  published: boolean;
  online: boolean;
}) {
  const [state, publish, publishing] = useActionState<StoreFormState>(publishStoreAction, {});
  const [optimisticOnline, setOptimisticOnline] = useOptimistic(online);
  const [, startTransition] = useTransition();
  const live = published && optimisticOnline;

  const [toggleError, setToggleError] = useState<string | null>(null);

  // The switch moves at once; if saving fails it moves back and says so.
  function toggleOnline(checked: boolean) {
    setToggleError(null);
    startTransition(async () => {
      setOptimisticOnline(checked);
      const failed = "Could not change whether your store is online. Try again.";
      try {
        const result = await setStoreOnlineAction(checked);
        if (!result.ok) setToggleError(failed);
      } catch {
        setToggleError(failed);
      }
    });
  }

  return (
    <Card
      title="Your store"
      description="Publish to make your saved changes live. Switch the store off to hide it from customers."
      actions={<StatusBadge status={live ? "online" : "offline"} />}
      footer={
        <form action={publish}>
          <Button type="submit" disabled={publishing} className="w-full sm:w-auto">
            {publishing ? "Publishing..." : "Publish store"}
          </Button>
        </form>
      }
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-body font-medium text-foreground">Store address</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href={address}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 break-all text-body text-primary underline-offset-4 hover:underline"
          >
            {address}
          </a>
          <CopyButton text={address} />
        </div>
      </div>
      <Switch
        label="Store online"
        description={published ? "Customers can visit your store while this is on." : "Publish your store first."}
        checked={published && optimisticOnline}
        disabled={!published}
        onCheckedChange={toggleOnline}
      />
      {toggleError ? <Alert tone="error">{toggleError}</Alert> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
    </Card>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy} aria-live="polite">
      {copied ? "Copied" : "Copy address"}
    </Button>
  );
}
