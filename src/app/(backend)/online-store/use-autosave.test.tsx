// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveDraftResult } from "./actions";
import { useAutosave } from "./use-autosave";

const DELAY = 800;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(save: (patch: unknown) => Promise<SaveDraftResult>) {
  return renderHook(() => useAutosave({ save, delayMs: DELAY, unpublishedChanges: false }));
}

describe("useAutosave", () => {
  it("saves once after the owner stops typing, with the edits of that section merged", async () => {
    const save = vi.fn(async () => ({ ok: true, unpublishedChanges: true }) as SaveDraftResult);
    const { result } = setup(save);

    act(() => result.current.queue("about", { content: { about: "We" } }));
    act(() => void vi.advanceTimersByTime(500));
    act(() => result.current.queue("about", { content: { about: "We fix" } }));
    act(() => void vi.advanceTimersByTime(DELAY - 1));
    expect(save).not.toHaveBeenCalled();

    await act(async () => void (await vi.advanceTimersByTimeAsync(1)));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ content: { about: "We fix" } });
  });

  it("shows Saving while the request runs, then Saved, and reports unpublished changes", async () => {
    let finish!: (result: SaveDraftResult) => void;
    const save = vi.fn(() => new Promise<SaveDraftResult>((resolve) => (finish = resolve)));
    const { result } = setup(save);
    expect(result.current.status).toBe("idle");
    expect(result.current.unpublishedChanges).toBe(false);

    act(() => result.current.queue("banner", { content: { banner: { enabled: true } } }));
    expect(result.current.status).toBe("saving");
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.status).toBe("saving");

    await act(async () => finish({ ok: true, unpublishedChanges: true }));
    expect(result.current.status).toBe("saved");
    expect(result.current.unpublishedChanges).toBe(true);
  });

  it("keeps the field errors of a section that failed and clears them when it saves", async () => {
    const save = vi
      .fn<(patch: unknown) => Promise<SaveDraftResult>>()
      .mockResolvedValueOnce({ ok: false, errors: { "brand.colors.primary": "Enter a colour like #0F766E." } })
      .mockResolvedValueOnce({ ok: true, unpublishedChanges: true });
    const { result } = setup(save);

    act(() => result.current.queue("brand", { brand: { colors: { primary: "teal" } } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.errors).toEqual({ "brand.colors.primary": "Enter a colour like #0F766E." });
    expect(result.current.status).toBe("error");

    act(() => result.current.queue("brand", { brand: { colors: { primary: "#0F766E" } } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.errors).toEqual({});
    expect(result.current.status).toBe("saved");
  });

  it("saves each section on its own timer, one request at a time", async () => {
    const order: unknown[] = [];
    const save = vi.fn(async (patch: unknown) => {
      order.push(patch);
      return { ok: true, unpublishedChanges: true } as SaveDraftResult;
    });
    const { result } = setup(save);

    act(() => result.current.queue("about", { content: { about: "Hi" } }));
    act(() => void vi.advanceTimersByTime(400));
    act(() => result.current.queue("tabs", { tabs: { sell: false } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY - 400)));
    expect(order).toEqual([{ content: { about: "Hi" } }]);
    await act(async () => void (await vi.advanceTimersByTimeAsync(400)));
    expect(order).toEqual([{ content: { about: "Hi" } }, { tabs: { sell: false } }]);
  });

  it("reports a failed request in plain words and keeps going", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue({ ok: true, unpublishedChanges: true });
    const { result } = setup(save);

    act(() => result.current.queue("about", { content: { about: "Hi" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.status).toBe("error");
    expect(result.current.errors).toEqual({ config: "Could not save. Check your connection and try again." });

    act(() => result.current.queue("about", { content: { about: "Hi again" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.status).toBe("saved");
  });
});
