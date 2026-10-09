// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfferedBrand } from "@/data";
import { SellForm } from "./sell-form";

const getOffer = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ getOffer }));

const brands: OfferedBrand[] = [
  {
    brand: "Apple",
    models: [{ deviceModelId: "m1", name: "iPhone 13", storages: ["128GB", "256GB"] }],
  },
];

async function fillEverything() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Brand"), "Apple");
  await user.selectOptions(screen.getByLabelText("Model"), "m1");
  await user.selectOptions(screen.getByLabelText("Storage"), "256GB");
  const yes = screen.getAllByRole("radio", { name: "Yes" });
  const no = screen.getAllByRole("radio", { name: "No" });
  await user.click(yes[0]);
  await user.click(no[1]);
  await user.click(yes[2]);
  return user;
}

describe("SellForm after a rejected submit", () => {
  beforeEach(() => {
    getOffer.mockReset();
    getOffer.mockResolvedValue({
      status: "error",
      fieldErrors: { battery_ok: "Answer this question." },
    });
  });

  it("keeps the chosen model, storage and answers", async () => {
    render(<SellForm slug="shop" brands={brands} />);
    const user = await fillEverything();
    await user.click(screen.getByRole("button", { name: "Get my offer" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((screen.getByLabelText("Brand") as HTMLSelectElement).value).toBe("Apple");
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe("m1");
    expect((screen.getByLabelText("Storage") as HTMLSelectElement).value).toBe("256GB");
    const yes = screen.getAllByRole("radio", { name: "Yes" }) as HTMLInputElement[];
    const no = screen.getAllByRole("radio", { name: "No" }) as HTMLInputElement[];
    expect([yes[0].checked, no[1].checked, yes[2].checked]).toEqual([true, true, true]);
  });

  it("announces the errors and marks the invalid controls", async () => {
    render(<SellForm slug="shop" brands={brands} />);
    const user = await fillEverything();
    await user.click(screen.getByRole("button", { name: "Get my offer" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Answer this question.");
    const battery = screen.getByRole("radiogroup", { name: /battery/i });
    expect(battery.getAttribute("aria-invalid")).toBe("true");
    const screenGroup = screen.getByRole("radiogroup", { name: /powers on/i });
    expect(screenGroup.getAttribute("aria-invalid")).toBeNull();
  });
});
