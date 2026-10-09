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

/** How a flush ended: everything saved, a field the server rejected, or a request that failed. */
export type FlushResult = "saved" | "invalid" | "failed";

/**
 * Debounced autosave for the store editor. `queue(section, patch)` waits
 * `delayMs` after the last edit of that section, then sends the merged patch
 * through `save`. Sections have their own timers but their requests run one
 * at a time, in the order they fire.
 *
 * A patch the server did not save (rejected or not reached) is kept and sent
 * again, under the section's next edit or a flush; newer edits override its
 * values. It is never resent by itself, so an invalid value cannot loop.
 * After every reply the errors of the fields that were sent are replaced by
 * the reply's own, so an error never outlives the field it was about.
 * `flush()` sends everything waiting or kept and says how it ended.
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
  // Patches the server has not saved, per section, to send again.
  const unsent = useRef(new Map<string, Patch>());
  const errorsRef = useRef<Record<string, FieldErrors>>({});
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorsBySection, setErrorsBySection] = useState<Record<string, FieldErrors>>({});
  const [unpublishedChanges, setUnpublishedChanges] = useState(initialUnpublished);

  const refreshSaving = useCallback(() => setSaving(pending.current.size > 0 || inFlight.current > 0), []);

  const updateErrors = useCallback((update: (current: FieldErrors) => FieldErrors, section: string) => {
    const next = update(errorsRef.current[section] ?? {});
    const all = { ...errorsRef.current };
    if (Object.keys(next).length > 0) all[section] = next;
    else delete all[section];
    errorsRef.current = all;
    setErrorsBySection(all);
  }, []);

  const run = useCallback(
    (section: string, patch: Patch) => {
      inFlight.current += 1;
      chain.current = chain.current.then(async () => {
        const kept = unsent.current.get(section);
        const toSend = kept ? mergePatch(kept, patch) : patch;
        // The fields this request answers; any error about them is replaced.
        const sent = leafPaths(toSend);
        const answers = (key: string) => sent.some((path) => key === path || key.startsWith(`${path}.`));
        try {
          const result = await saveRef.current(toSend);
          if (result.ok) {
            unsent.current.delete(section);
            setUnpublishedChanges(result.unpublishedChanges);
            setSaved(true);
            updateErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== "config" && !answers(k))), section);
          } else {
            unsent.current.set(section, toSend);
            updateErrors(
              (current) => ({
                ...Object.fromEntries(Object.entries(current).filter(([k]) => k !== "config" && !answers(k))),
                ...result.errors,
              }),
              section,
            );
          }
        } catch {
          unsent.current.set(section, toSend);
          updateErrors((current) => ({ ...current, config: NETWORK_ERROR }), section);
        } finally {
          inFlight.current -= 1;
          refreshSaving();
        }
      });
      return chain.current;
    },
    [refreshSaving, updateErrors],
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

  const flush = useCallback(async (): Promise<FlushResult> => {
    const waiting = new Set(pending.current.keys());
    for (const [section, { patch, timer }] of [...pending.current]) {
      clearTimeout(timer);
      pending.current.delete(section);
      void run(section, patch);
    }
    // Patches kept after an unsuccessful save are tried again too.
    for (const section of [...unsent.current.keys()]) {
      if (!waiting.has(section)) void run(section, {});
    }
    refreshSaving();
    await chain.current;
    if (unsent.current.size === 0) return "saved";
    const invalid = Object.values(errorsRef.current).some((e) => Object.keys(e).some((k) => k !== "config"));
    return invalid ? "invalid" : "failed";
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
