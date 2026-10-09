// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadSlotsAction = vi.fn();
const bookRepairAction = vi.fn();
vi.mock("./actions", () => ({
  loadSlotsAction: (...args: unknown[]) => loadSlotsAction(...args),
  bookRepairAction: (...args: unknown[]) => bookRepairAction(...args),
}));

import { RepairBooking } from "./repair-booking";

const brands = [
  {
    brand: "Apple",
    models: [
      {
        deviceModelId: "m1",
        name: "iPhone 12",
        repairs: [{ repairPriceId: "p1", repairType: "Screen", price: 8900, partQty: 2 }],
      },
    ],
  },
];
const SLOTS = ["2030-01-10T09:00:00.000Z", "2030-01-10T09:30:00.000Z"];
const NEW_SLOTS = ["2030-01-10T10:00:00.000Z"];

function setup() {
  render(<RepairBooking slug="shop" brands={brands} timezone="Europe/Dublin" firstDate="2030-01-10" lastDate="2030-02-09" />);
}

async function reachSlots(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Apple" }));
  await user.click(screen.getByRole("button", { name: "iPhone 12" }));
  await user.click(screen.getByRole("button", { name: "Screen" }));
}

beforeEach(() => {
  loadSlotsAction.mockReset();
  bookRepairAction.mockReset();
  loadSlotsAction.mockResolvedValue({ ok: true, slots: SLOTS });
});

describe("RepairBooking", () => {
  it("shows the slot taken message outside the form, refreshes the slots and drops it on the next pick", async () => {
    const user = userEvent.setup();
    setup();
    await reachSlots(user);
    await user.click(await screen.findByRole("button", { name: "9am" }));

    bookRepairAction.mockResolvedValue({
      status: "error",
      message: "That time was just taken. Pick another time.",
      slotTaken: true,
      values: { name: "John", phone: "085 123 4567", email: "j@example.com" },
    });
    loadSlotsAction.mockResolvedValue({ ok: true, slots: NEW_SLOTS });
    await user.type(screen.getByLabelText("Name"), "John");
    await user.click(screen.getByRole("button", { name: "Book repair" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That time was just taken");
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(await screen.findByRole("button", { name: "10am" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "10am" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the slots when the date leaves the booking window", async () => {
    const user = userEvent.setup();
    setup();
    await reachSlots(user);
    expect(await screen.findByRole("button", { name: "9am" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Pick a day/), { target: { value: "2031-01-01" } });
    expect(screen.queryByRole("button", { name: "9am" })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Pick a day/), { target: { value: "" } });
    expect(screen.queryByRole("button", { name: "9am" })).toBeNull();
  });

  it("drops a slot response that arrives after the day changed", async () => {
    const user = userEvent.setup();
    setup();
    let resolveFirst: (v: unknown) => void = () => {};
    loadSlotsAction.mockReturnValueOnce(new Promise((r) => (resolveFirst = r)));
    await reachSlots(user);

    loadSlotsAction.mockResolvedValueOnce({ ok: true, slots: NEW_SLOTS });
    fireEvent.change(screen.getByLabelText(/Pick a day/), { target: { value: "2030-01-11" } });
    expect(await screen.findByRole("button", { name: "10am" })).toBeInTheDocument();

    resolveFirst({ ok: true, slots: SLOTS });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("button", { name: "9am" })).toBeNull();
    expect(screen.getByRole("button", { name: "10am" })).toBeInTheDocument();
  });

  it("says when the slot list is rate limited", async () => {
    const user = userEvent.setup();
    loadSlotsAction.mockResolvedValue({ ok: false, reason: "rate_limited" });
    setup();
    await reachSlots(user);
    expect(await screen.findByText("Too many requests. Wait a minute, then try again.")).toBeInTheDocument();
    expect(screen.queryByText(/No times free/)).toBeNull();
  });

  it("shows an error with a retry when loading the slots throws", async () => {
    const user = userEvent.setup();
    loadSlotsAction.mockRejectedValueOnce(new Error("network"));
    setup();
    await reachSlots(user);
    expect(await screen.findByText("We could not load the times.")).toBeInTheDocument();
    expect(screen.queryByText("Loading times...")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "9am" })).toBeInTheDocument();
  });

  it("moves focus to the first invalid field after a failed submit", async () => {
    const user = userEvent.setup();
    setup();
    await reachSlots(user);
    await user.click(await screen.findByRole("button", { name: "9am" }));

    bookRepairAction.mockResolvedValue({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { phone: "Enter a phone number like 085 123 4567." },
      values: { name: "John", phone: "x", email: "j@example.com" },
    });
    await user.type(screen.getByLabelText("Name"), "John");
    await user.click(screen.getByRole("button", { name: "Book repair" }));

    await waitFor(() => expect(screen.getByLabelText("Phone")).toHaveFocus());
    expect(screen.getByLabelText("Phone")).toHaveAttribute("aria-invalid", "true");
  });
});
