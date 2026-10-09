// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const publishStoreAction = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ publishStoreAction, setStoreOnlineAction: vi.fn() }));

import { StoreStatusCard } from "./store-status-card";

function renderCard(flush: () => Promise<"saved" | "invalid" | "failed">, onPublished = vi.fn()) {
  render(
    <StoreStatusCard
      address="http://localhost/s/fixit"
      previewUrl="http://localhost/s/fixit?preview"
      published
      online
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
