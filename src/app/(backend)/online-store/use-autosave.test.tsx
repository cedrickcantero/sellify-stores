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

  it("clears the unpublished flag when told the store was published, with no prop change", async () => {
    const save = vi.fn(async () => ({ ok: true, unpublishedChanges: true }) as SaveDraftResult);
    const { result } = setup(save);
    expect(result.current.unpublishedChanges).toBe(false);

    act(() => result.current.queue("about", { content: { about: "Hi" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.unpublishedChanges).toBe(true);

    act(() => result.current.markPublished());
    expect(result.current.unpublishedChanges).toBe(false);

    act(() => result.current.queue("about", { content: { about: "Hi again" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.unpublishedChanges).toBe(true);
  });

  it("keeps a rejected patch, so an invalid field's error stays until that field is fixed", async () => {
    const save = vi
      .fn<(patch: unknown) => Promise<SaveDraftResult>>()
      .mockResolvedValueOnce({ ok: false, errors: { "brand.colors.primary": "Enter a colour like #0F766E." } })
      .mockResolvedValueOnce({ ok: false, errors: { "brand.colors.primary": "Enter a colour like #0F766E." } })
      .mockResolvedValue({ ok: true, unpublishedChanges: true });
    const { result } = setup(save);

    act(() => result.current.queue("brand", { brand: { colors: { primary: "#12" } } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    act(() => result.current.queue("brand", { brand: { colors: { accent: "#00ff00" } } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.errors).toEqual({ "brand.colors.primary": "Enter a colour like #0F766E." });
    expect(result.current.status).toBe("error");

    act(() => result.current.queue("brand", { brand: { colors: { primary: "#112233" } } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(save).toHaveBeenLastCalledWith({ brand: { colors: { primary: "#112233", accent: "#00ff00" } } });
    expect(result.current.errors).toEqual({});
    expect(result.current.status).toBe("saved");
  });

  it("A: a valid phone sent with a bad email is still saved once the email is fixed", async () => {
    const save = vi
      .fn<(patch: unknown) => Promise<SaveDraftResult>>()
      .mockResolvedValueOnce({ ok: false, errors: { "contact.email": "Enter an email like hello@yourshop.ie." } })
      .mockResolvedValue({ ok: true, unpublishedChanges: true });
    const { result } = setup(save);

    act(() => result.current.queue("contact", { contact: { phone: "0851234567" } }));
    act(() => result.current.queue("contact", { contact: { email: "nope" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.errors).toEqual({ "contact.email": "Enter an email like hello@yourshop.ie." });

    act(() => result.current.queue("contact", { contact: { email: "hi@shop.ie" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(save).toHaveBeenLastCalledWith({ contact: { phone: "0851234567", email: "hi@shop.ie" } });
    expect(result.current.errors).toEqual({});
  });

  it("B: an old error clears when a later rejection no longer lists that field", async () => {
    const save = vi
      .fn<(patch: unknown) => Promise<SaveDraftResult>>()
      .mockResolvedValueOnce({ ok: false, errors: { "contact.email": "Enter an email like hello@yourshop.ie." } })
      .mockResolvedValueOnce({ ok: false, errors: { "contact.phone": "Keep the phone number to 40 characters." } });
    const { result } = setup(save);

    act(() => result.current.queue("contact", { contact: { email: "nope" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    act(() => result.current.queue("contact", { contact: { email: "hi@shop.ie", phone: "x".repeat(41) } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.errors).toEqual({ "contact.phone": "Keep the phone number to 40 characters." });
  });

  it("does not resend a rejected patch by itself", async () => {
    const save = vi.fn(async () => ({ ok: false, errors: { "contact.email": "Bad." } }) as SaveDraftResult);
    const { result } = setup(save);

    act(() => result.current.queue("contact", { contact: { email: "nope" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY * 5)));
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");
  });

  it("clears a stale network error when a later reply arrives", async () => {
    const save = vi
      .fn<(patch: unknown) => Promise<SaveDraftResult>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: false, errors: { "contact.email": "Bad." } });
    const { result } = setup(save);

    act(() => result.current.queue("contact", { contact: { phone: "1" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    act(() => result.current.queue("contact", { contact: { email: "nope" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.errors).toEqual({ "contact.email": "Bad." });
  });

  it("flush resends kept patches and reports saved, invalid or failed", async () => {
    const save = vi
      .fn<(patch: unknown) => Promise<SaveDraftResult>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: false, errors: { "contact.phone": "Bad." } })
      .mockResolvedValue({ ok: true, unpublishedChanges: true });
    const { result } = setup(save);

    act(() => result.current.queue("contact", { contact: { phone: "1" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    let outcome: string = "";
    await act(async () => void (outcome = await result.current.flush()));
    expect(outcome).toBe("failed");
    await act(async () => void (outcome = await result.current.flush()));
    expect(outcome).toBe("invalid");
    await act(async () => void (outcome = await result.current.flush()));
    expect(outcome).toBe("saved");
    expect(result.current.errors).toEqual({});
  });

  it("resends a patch lost to a network failure together with the next edit", async () => {
    const save = vi
      .fn<(patch: unknown) => Promise<SaveDraftResult>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ ok: true, unpublishedChanges: true });
    const { result } = setup(save);

    act(() => result.current.queue("brand", { brand: { colors: { primary: "#112233" } } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(result.current.status).toBe("error");

    act(() => result.current.queue("brand", { brand: { colors: { accent: "#00ff00" } } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(save).toHaveBeenLastCalledWith({ brand: { colors: { primary: "#112233", accent: "#00ff00" } } });
    expect(result.current.errors).toEqual({});
    expect(result.current.status).toBe("saved");
  });

  it("flush sends waiting edits at once and resolves after they are saved", async () => {
    const save = vi.fn(async () => ({ ok: true, unpublishedChanges: true }) as SaveDraftResult);
    const { result } = setup(save);

    act(() => result.current.queue("about", { content: { about: "Last edit" } }));
    await act(async () => expect(await result.current.flush()).toBe("saved"));
    expect(save).toHaveBeenCalledWith({ content: { about: "Last edit" } });
    expect(result.current.status).toBe("saved");

    await act(async () => void (await vi.advanceTimersByTimeAsync(DELAY)));
    expect(save).toHaveBeenCalledTimes(1);
  });
});
