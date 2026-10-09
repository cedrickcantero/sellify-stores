// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const publishStoreAction = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ publishStoreAction, setStoreOnlineAction: vi.fn() }));

import { StoreStatusCard } from "./store-status-card";

function renderCard(
  flush: () => Promise<"saved" | "invalid" | "failed">,
  onPublished = vi.fn(),
  state = { published: true, online: true },
) {
  render(
    <StoreStatusCard
      address="http://localhost/s/fixit"
      previewUrl="http://localhost/s/fixit?preview"
      published={state.published}
      online={state.online}
      unpublishedChanges
      flush={flush}
      onPublished={onPublished}
    />,
  );
  return onPublished;
}

beforeEach(() => publishStoreAction.mockReset());

describe("Publish", () => {
  it("does not publish when a save failed, and leaves the unpublished badge alone", async () => {
    const onPublished = renderCard(async () => "failed");
    await userEvent.click(screen.getByRole("button", { name: "Publish store" }));
    expect(publishStoreAction).not.toHaveBeenCalled();
    expect(onPublished).not.toHaveBeenCalled();
    expect(screen.getByText("Could not save. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByText("Unpublished changes")).toBeInTheDocument();
  });

  it("does not publish while a field is invalid", async () => {
    const onPublished = renderCard(async () => "invalid");
    await userEvent.click(screen.getByRole("button", { name: "Publish store" }));
    expect(publishStoreAction).not.toHaveBeenCalled();
    expect(onPublished).not.toHaveBeenCalled();
    expect(screen.getByText("Fix the highlighted fields, then publish.")).toBeInTheDocument();
  });

  it("publishes after everything saved and tells the page", async () => {
    publishStoreAction.mockResolvedValue({ message: "Store published." });
    const onPublished = renderCard(async () => "saved");
    await userEvent.click(screen.getByRole("button", { name: "Publish store" }));
    expect(publishStoreAction).toHaveBeenCalledTimes(1);
    expect(onPublished).toHaveBeenCalledTimes(1);
  });
});

describe("Publish on a store that was never published", () => {
  it("shows online, switches on and drops 'Publish your store first' with the success message", async () => {
    publishStoreAction.mockResolvedValue({ message: "Store published. It is live at your store address." });
    // The server props stay stale: the page has not refreshed yet.
    renderCard(async () => "saved", vi.fn(), { published: false, online: false });
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByText("Publish your store first.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Publish store" }));

    expect(await screen.findByText("Store published. It is live at your store address.")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish your store first.")).not.toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Store online" });
    expect(toggle).toBeEnabled();
    expect(toggle).toBeChecked();
  });

  it("stays offline when publishing fails", async () => {
    publishStoreAction.mockResolvedValue({ error: "Fix the highlighted store settings, then publish again." });
    renderCard(async () => "saved", vi.fn(), { published: false, online: false });
    await userEvent.click(screen.getByRole("button", { name: "Publish store" }));
    expect(await screen.findByText(/Fix the highlighted store settings/)).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });
});
