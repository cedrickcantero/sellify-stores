import type { FieldErrors, StoreConfig } from "@/domain/store-config";

// What every editor section receives: the saved draft to start from, the
// field errors from the last save of any section, and `queue`, which sends a
// patch for that section to the debounced autosave.
export type EditorSection = {
  draft: StoreConfig;
  errors: FieldErrors;
  queue: (section: string, patch: Record<string, unknown>) => void;
};
