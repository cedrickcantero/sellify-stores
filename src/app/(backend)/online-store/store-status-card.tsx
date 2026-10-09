"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Alert, Button, Card, StatusBadge, Switch } from "@/ui";
import type { FlushResult } from "./use-autosave";
import { publishStoreAction, setStoreOnlineAction, type StoreFormState } from "./actions";

// Store status, live address, the online switch and the Publish button.
export function StoreStatusCard({
  address,
  previewUrl,
  published: serverPublished,
  online: serverOnline,
  unpublishedChanges,
  flush,
  onPublished,
}: {
  address: string;
  previewUrl: string;
  unpublishedChanges: boolean;
  /** Sends any edits still waiting to be autosaved; resolves when done. */
  flush: () => Promise<FlushResult>;
  /** Called after a successful publish. */
  onPublished: () => void;
  published: boolean;
  online: boolean;
}) {
  const [state, setState] = useState<StoreFormState>({});
  const [publishing, setPublishing] = useState(false);
  // Publishing puts the store online. The page's props catch up a moment
  // later, so until they change this card shows the result itself.
  const [justPublished, setJustPublished] = useState(false);
  const [seen, setSeen] = useState({ serverPublished, serverOnline });
  if (seen.serverPublished !== serverPublished || seen.serverOnline !== serverOnline) {
    setSeen({ serverPublished, serverOnline });
    setJustPublished(false);
  }
  const published = serverPublished || justPublished;
  const online = serverOnline || justPublished;
  const [optimisticOnline, setOptimisticOnline] = useOptimistic(online);
  const [, startTransition] = useTransition();
  const live = published && optimisticOnline;

  // The last edit is saved first, so what is published includes it.
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublishing(true);
    try {
      // Publishing copies the saved draft, so nothing may be left unsaved.
      const saved = await flush();
      if (saved !== "saved") {
        setState({
          error:
            saved === "invalid"
              ? "Fix the highlighted fields, then publish."
              : "Could not save. Check your connection and try again.",
        });
        return;
      }
      const result = await publishStoreAction();
      setState(result);
      if (!result.error) {
        setJustPublished(true);
        onPublished();
      }
    } catch {
      setState({ error: "Could not publish. Check your connection and try again." });
    } finally {
      setPublishing(false);
    }
  }

  // Open the tab straight away (a popup after an await can be blocked), then
  // point it at the preview once the last edit is saved.
  async function preview() {
    const tab = window.open("about:blank", "_blank");
    await flush();
    if (tab) tab.location.href = previewUrl;
    else window.location.assign(previewUrl);
  }

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
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {unpublishedChanges ? <StatusBadge status="unpublished" /> : null}
          <StatusBadge status={live ? "online" : "offline"} />
        </div>
      }
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={preview} className="w-full sm:w-auto">
            Preview draft
          </Button>
          <form onSubmit={publish}>
            <Button type="submit" disabled={publishing} className="w-full sm:w-auto">
              {publishing ? "Publishing..." : "Publish store"}
            </Button>
          </form>
        </div>
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
