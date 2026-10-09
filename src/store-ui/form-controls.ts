// Class names for forms on the store surface, built only from the store's
// own variables so every shop's forms follow its brand.
export const storeControlClass =
  "h-11 w-full rounded-(--store-radius) border border-(--store-text)/60 bg-(--store-bg) px-3 text-base text-(--store-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary) disabled:opacity-60";

export const storeButtonClass =
  "inline-flex h-11 items-center justify-center rounded-(--store-radius) bg-(--store-primary) px-6 font-semibold text-(--store-on-primary) hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary) disabled:opacity-60";

export const storeLinkButtonClass =
  "inline-flex h-11 items-center justify-center rounded-(--store-radius) border-2 border-(--store-primary) px-6 font-semibold text-(--store-primary) hover:bg-(--store-primary) hover:text-(--store-on-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary)";
