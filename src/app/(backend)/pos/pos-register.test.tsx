// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosRegister } from "./pos-register";

// The server action is the boundary to the database; the page's own
// behaviour is what is under test.
const completePosSaleAction = vi.fn();
vi.mock("./actions", () => ({
  completePosSaleAction: (input: unknown) => completePosSaleAction(input),
}));

const products = [{ id: "p1", title: "Pixel 8", price: 25000, stockQty: 5 }];

describe("PosRegister", () => {
  beforeEach(() => completePosSaleAction.mockReset());

  it("warns about a negative or fractional quantity and does not sell", async () => {
    render(<PosRegister products={products} />);
    const input = screen.getByLabelText("Quantity of Pixel 8");

    await userEvent.type(input, "-1");
    expect(screen.getByText(/Enter a whole number of 1 or more for Pixel 8/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Complete sale" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await userEvent.clear(input);
    await userEvent.type(input, "1.5");
    expect(screen.getByText(/Enter a whole number of 1 or more/)).toBeTruthy();
    expect(completePosSaleAction).not.toHaveBeenCalled();
  });

  it("shows the total the server saved, not the one computed in the browser", async () => {
    completePosSaleAction.mockResolvedValue({ saleId: "s1", total: 49900 });
    render(<PosRegister products={products} />);

    await userEvent.type(screen.getByLabelText("Quantity of Pixel 8"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Complete sale" }));

    await waitFor(() => expect(screen.getByText("Sale completed: €499.00.")).toBeTruthy());
    expect(completePosSaleAction).toHaveBeenCalledWith([{ productId: "p1", qty: 2 }]);
  });
});
