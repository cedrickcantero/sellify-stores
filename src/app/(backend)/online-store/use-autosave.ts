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

// The dotted paths a patch sets, to know which field errors it answers. A
// null (closed day) or an empty object counts as its own path.
function leafPaths(patch: Patch, prefix = ""): string[] {
  return Object.entries(patch).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isPlain(value) && Object.keys(value).length > 0 ? leafPaths(value, path) : [path];
  });
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
 * at a time, in the order they fire.
 *
 * Field errors stay until a save contains that field again, so an invalid
 * value is never reported as saved. A request that fails to reach the server
 * is kept and sent again with the section's next edit. `flush()` sends
 * everything waiting and resolves when it has been saved or has failed.
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
  // Patches that could not be sent (network), per section, to retry.
  const unsent = useRef(new Map<string, Patch>());
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
        const toSend = unsent.current.has(section) ? mergePatch(unsent.current.get(section)!, patch) : patch;
        try {
          const result = await saveRef.current(toSend);
          unsent.current.delete(section);
          if (result.ok) {
            setUnpublishedChanges(result.unpublishedChanges);
            setSaved(true);
            // Only the fields this save contained are answered.
            const answered = leafPaths(toSend);
            setErrorsBySection((all) => {
              const current = all[section];
              if (!current) return all;
              const kept = Object.fromEntries(
                Object.entries(current).filter(
                  ([key]) => key !== "config" && !answered.some((path) => key === path || key.startsWith(`${path}.`)),
                ),
              );
              const rest = { ...all };
              if (Object.keys(kept).length > 0) rest[section] = kept;
              else delete rest[section];
              return rest;
            });
          } else {
            setErrorsBySection((all) => ({ ...all, [section]: { ...all[section], ...result.errors } }));
          }
        } catch {
          unsent.current.set(section, toSend);
          setErrorsBySection((all) => ({ ...all, [section]: { ...all[section], config: NETWORK_ERROR } }));
        } finally {
          inFlight.current -= 1;
          refreshSaving();
        }
      });
      return chain.current;
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
        void run(section, merged);
      }, delayMs);
      pending.current.set(section, { patch: merged, timer });
      setSaved(false);
      refreshSaving();
    },
    [delayMs, refreshSaving, run],
  );

  const flush = useCallback(async () => {
    for (const [section, { patch, timer }] of [...pending.current]) {
      clearTimeout(timer);
      pending.current.delete(section);
      void run(section, patch);
    }
    refreshSaving();
    await chain.current;
  }, [refreshSaving, run]);

  // Leaving the page sends what is still waiting instead of dropping it.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const [section, { patch, timer }] of waiting) {
        clearTimeout(timer);
        void run(section, patch);
      }
      waiting.clear();
    };
  }, [run]);

  // Adopt a new server value when the page re-renders with one.
  const [seenUnpublished, setSeenUnpublished] = useState(initialUnpublished);
  if (seenUnpublished !== initialUnpublished) {
    setSeenUnpublished(initialUnpublished);
    setUnpublishedChanges(initialUnpublished);
  }

  // Publishing makes the draft the published copy; the server prop may not
  // change (false before and after), so the page says so itself.
  const markPublished = useCallback(() => setUnpublishedChanges(false), []);

  const errors: FieldErrors = Object.assign({}, ...Object.values(errorsBySection));
  const hasErrors = Object.keys(errors).length > 0;
  const status: SaveStatus = saving ? "saving" : hasErrors ? "error" : saved ? "saved" : "idle";

  return { queue, flush, markPublished, status, errors, unpublishedChanges };
}
