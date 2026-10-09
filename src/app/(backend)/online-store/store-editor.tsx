"use client";

import type { StoreConfig } from "@/domain/store-config";
import { Alert } from "@/ui";
import { saveDraftAction } from "./actions";
import { AboutCard, BannerCard, BrandCard, ContactCard, RepairCard, TabsCard } from "./editor-sections";
import { OpeningHoursCard } from "./opening-hours-card";
import { StoreDetailsForm } from "./store-details-form";
import { StoreStatusCard } from "./store-status-card";
import { useAutosave } from "./use-autosave";

const STATUS_TEXT = {
  idle: "",
  saving: "Saving...",
  saved: "All changes saved to your draft.",
  error: "Some changes were not saved. Fix the highlighted fields.",
} as const;

function fieldErrorCount(errors: Record<string, string>): number {
  return Object.keys(errors).filter((key) => key !== "config").length;
}

// The whole Online Store page: status and publish on top, then one card per
// part of the store. Every edit goes to the draft after a short pause.
export function StoreEditor({
  draft,
  address,
  previewUrl,
  published,
  online,
  unpublishedChanges: initialUnpublished,
}: {
  draft: StoreConfig;
  address: string;
  previewUrl: string;
  published: boolean;
  online: boolean;
  unpublishedChanges: boolean;
}) {
  const { queue, flush, markPublished, status, errors, unpublishedChanges } = useAutosave({
    save: saveDraftAction,
    unpublishedChanges: initialUnpublished,
  });
  const section = { draft, errors, queue };

  return (
    <div className="flex flex-col gap-6">
      <StoreStatusCard
        address={address}
        previewUrl={previewUrl}
        published={published}
        online={online}
        unpublishedChanges={unpublishedChanges}
        flush={flush}
        onPublished={markPublished}
      />
      <p role="status" aria-live="polite" className="min-h-5 text-small text-muted-foreground">
        {status === "error" && fieldErrorCount(errors) === 0 ? errors.config : STATUS_TEXT[status]}
      </p>
      {errors.config ? <Alert tone="error">{errors.config}</Alert> : null}
      <StoreDetailsForm name={draft.brand.name} logoUrl={draft.brand.logoUrl} />
      <BrandCard {...section} />
      <BannerCard {...section} />
      <AboutCard {...section} />
      <ContactCard {...section} />
      <OpeningHoursCard {...section} />
      <RepairCard {...section} />
      <TabsCard {...section} />
    </div>
  );
}
