// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBar, type FilterDef } from "./filter-bar";

// The URL is the boundary: FilterBar reads the current search params and
// replaces the URL when a filter changes, so the server page re-renders the
// filtered table.
const navigation = vi.hoisted(() => {
  const state = {
    params: new URLSearchParams(),
    // Like the real router, replacing the URL changes the search params the
    // next render reads.
    replace: vi.fn((url: string) => {
      state.params = new URLSearchParams(url.split("?")[1] ?? "");
    }),
  };
  return state;
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/inventory",
  useSearchParams: () => navigation.params,
}));

const filters: FilterDef[] = [
  {
    param: "kind",
    label: "Kind",
    options: [
      { value: "phone", label: "Phones" },
      { value: "accessory", label: "Accessories" },
    ],
  },
  {
    param: "stock",
    label: "Stock",
    options: [
      { value: "in", label: "In stock" },
      { value: "out", label: "Sold out" },
    ],
  },
];

function lastUrl(): string | undefined {
  return navigation.replace.mock.lastCall?.[0];
}

beforeEach(() => {
  navigation.replace.mockClear();
  navigation.params = new URLSearchParams();
});

describe("FilterBar", () => {
  it("shows the filter in the URL as selected and All otherwise", () => {
    navigation.params = new URLSearchParams("kind=phone");
    render(<FilterBar filters={filters} />);

    const kind = screen.getByRole("radiogroup", { name: "Kind" });
    expect(kind).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Phones" })).toBeChecked();
    expect(screen.getAllByRole("radio", { name: "All" })[0]).not.toBeChecked();
    expect(screen.getAllByRole("radio", { name: "All" })[1]).toBeChecked();
  });

  it("is operated with the keyboard: Tab to a group, arrows to move, Space to choose", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("q=iphone");
    render(<FilterBar filters={filters} />);

    await user.tab();
    expect(screen.getAllByRole("radio", { name: "All" })[0]).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Phones" })).toHaveFocus();

    await user.keyboard(" ");
    expect(lastUrl()).toBe("/inventory?q=iphone&kind=phone");
  });

  it("gives each group one tab stop", async () => {
    const user = userEvent.setup();
    render(<FilterBar filters={filters} />);

    await user.tab();
    await user.tab();

    expect(screen.getAllByRole("radio", { name: "All" })[1]).toHaveFocus();
  });

  it("removes the filter from the URL when All is chosen", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("kind=phone&stock=in");
    render(<FilterBar filters={filters} />);

    await user.click(screen.getAllByRole("radio", { name: "All" })[0]);

    expect(lastUrl()).toBe("/inventory?stock=in");
  });

  it("does nothing when the selected filter is chosen again", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("kind=phone");
    render(<FilterBar filters={filters} />);

    await user.click(screen.getByRole("radio", { name: "Phones" }));

    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("searches on Enter and clears the search when emptied", async () => {
    const user = userEvent.setup();
    const bar = <FilterBar filters={filters} search={{ param: "q", placeholder: "Search products" }} />;
    const { rerender } = render(bar);

    const search = screen.getByRole("searchbox", { name: "Search products" });
    await user.type(search, "pixel{Enter}");
    expect(lastUrl()).toBe("/inventory?q=pixel");
    rerender(bar);

    await user.clear(search);
    await user.keyboard("{Enter}");
    expect(lastUrl()).toBe("/inventory");
  });
});
