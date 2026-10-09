"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup } from "radix-ui";
import { useId, useState, useTransition, type ReactNode } from "react";
import { cn } from "./cn";
import { Input } from "./input";
import { pillVariants } from "./pill";

export type FilterDef = {
  /** Search param the filter writes, for example "kind" for ?kind=phone. */
  param: string;
  /** Group label, for example "Kind". */
  label: string;
  options: { value: string; label: string }[];
  /** Label of the "no filter" pill. Defaults to "All". */
  allLabel?: string;
};

const ALL = "__all";

/**
 * The row of filters above a Table. Each filter is a group of pills with
 * one choice; the choice lives in the URL search params, so the server page
 * reads `searchParams` and filters its query. Keyboard: Tab moves between
 * groups, Arrow keys move between pills, Space or Enter chooses.
 */
export function FilterBar({
  filters,
  search,
  children,
}: {
  filters: FilterDef[];
  /** Optional free-text search, applied on Enter or with the next pill change. */
  search?: { param: string; placeholder: string };
  /** Right-aligned actions such as the page's primary Button. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // The search box is controlled so its text travels with a pill change.
  // When the URL's search changes elsewhere (back button, a link), the box
  // follows it.
  const urlSearch = search ? (params.get(search.param) ?? "") : "";
  const [searchText, setSearchText] = useState(urlSearch);
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);
  if (urlSearch !== syncedSearch) {
    setSyncedSearch(urlSearch);
    setSearchText(urlSearch);
  }

  // Applies one change plus any search text typed but not yet submitted.
  function setParam(param: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (search) {
      const text = searchText.trim();
      if (text) next.set(search.param, text);
      else next.delete(search.param);
    }
    if (value) next.set(param, value);
    else next.delete(param);
    if (next.toString() === params.toString()) return;
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      data-pending={pending || undefined}
      className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center"
    >
      {search ? (
        <form
          role="search"
          className="relative lg:w-64"
          onSubmit={(event) => {
            event.preventDefault();
            setParam(search.param, searchText.trim() || null);
          }}
        >
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            name={search.param}
            aria-label={search.placeholder}
            placeholder={search.placeholder}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="pl-9"
          />
        </form>
      ) : null}
      {filters.map((filter) => (
        <FilterGroup
          key={filter.param}
          filter={filter}
          value={params.get(filter.param)}
          onChange={(value) => setParam(filter.param, value)}
        />
      ))}
      {children ? <div className="flex gap-2 lg:ml-auto">{children}</div> : null}
    </div>
  );
}

function FilterGroup({
  filter,
  value,
  onChange,
}: {
  filter: FilterDef;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const labelId = useId();
  const options = [{ value: ALL, label: filter.allLabel ?? "All" }, ...filter.options];
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span id={labelId} className="shrink-0 text-small font-medium text-muted-foreground">
        {filter.label}
      </span>
      <ToggleGroup.Root
        type="single"
        aria-labelledby={labelId}
        value={value ?? ALL}
        // Choosing the selected pill again sends "", which keeps it selected.
        onValueChange={(next) => {
          if (next) onChange(next === ALL ? null : next);
        }}
        className="-my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1"
      >
        {options.map((option) => (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              pillVariants({ tone: "neutral" }),
              "cursor-pointer hover:bg-surface-muted",
              "data-[state=on]:border-primary-border data-[state=on]:bg-primary-tint data-[state=on]:text-primary",
            )}
          >
            {option.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
