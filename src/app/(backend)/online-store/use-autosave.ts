"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldErrors } from "@/domain/store-config";
import type { SaveDraftResult } from "./actions";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const NETWORK_ERROR = "Could not save. Check your connection and try again.";

type Patch = Record<string, unknown>;

function isPlain(value: unknown): value is Patch {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Later edits win; objects merge so two fields of one section become one patch.
function mergePatch(base: Patch, next: Patch): Patch {
  const out: Patch = { ...base };
  for (const [key, value] of Object.entries(next)) {
    out[key] = isPlain(out[key]) && isPlain(value) ? mergePatch(out[key], value) : value;
  }
  return out;
}

/**
 * Debounced autosave for the store editor. `queue(section, patch)` waits
 * `delayMs` after the last edit of that section, then sends the merged patch
 * through `save`. Sections have their own timers but their requests run one
 * at a time, in the order they fire. Field errors are kept per section until
 * that section saves again.
 */
export function useAutosave({
  save,
  delayMs = 800,
  unpublishedChanges: initialUnpublished,
}: {
  save: (patch: unknown) => Promise<SaveDraftResult>;
  delayMs?: number;
  unpublishedChanges: boolean;
}) {
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const pending = useRef(new Map<string, { patch: Patch; timer: ReturnType<typeof setTimeout> }>());
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorsBySection, setErrorsBySection] = useState<Record<string, FieldErrors>>({});
  const [unpublishedChanges, setUnpublishedChanges] = useState(initialUnpublished);

  const refreshSaving = useCallback(() => setSaving(pending.current.size > 0 || inFlight.current > 0), []);

  const run = useCallback(
    (section: string, patch: Patch) => {
      inFlight.current += 1;
      chain.current = chain.current.then(async () => {
        try {
          const result = await saveRef.current(patch);
          if (result.ok) {
            setUnpublishedChanges(result.unpublishedChanges);
            setSaved(true);
            setErrorsBySection((all) => {
              const rest = { ...all };
              delete rest[section];
              return rest;
            });
          } else {
            setErrorsBySection((all) => ({ ...all, [section]: result.errors }));
          }
        } catch {
          setErrorsBySection((all) => ({ ...all, [section]: { config: NETWORK_ERROR } }));
        } finally {
          inFlight.current -= 1;
          refreshSaving();
        }
      });
    },
    [refreshSaving],
  );

  const queue = useCallback(
    (section: string, patch: Patch) => {
      const existing = pending.current.get(section);
      if (existing) clearTimeout(existing.timer);
      const merged = existing ? mergePatch(existing.patch, patch) : patch;
      const timer = setTimeout(() => {
        pending.current.delete(section);
        run(section, merged);
      }, delayMs);
      pending.current.set(section, { patch: merged, timer });
      setSaved(false);
      refreshSaving();
    },
    [delayMs, refreshSaving, run],
  );

  // Leaving the page sends what is still waiting instead of dropping it.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const [section, { patch, timer }] of waiting) {
        clearTimeout(timer);
        run(section, patch);
      }
      waiting.clear();
    };
  }, [run]);

  // Adopt a new server value (after Publish, the page re-renders with false).
  const [seenUnpublished, setSeenUnpublished] = useState(initialUnpublished);
  if (seenUnpublished !== initialUnpublished) {
    setSeenUnpublished(initialUnpublished);
    setUnpublishedChanges(initialUnpublished);
  }

  const errors: FieldErrors = Object.assign({}, ...Object.values(errorsBySection));
  const hasErrors = Object.keys(errors).length > 0;
  const status: SaveStatus = saving ? "saving" : hasErrors ? "error" : saved ? "saved" : "idle";

  return { queue, status, errors, unpublishedChanges };
}
