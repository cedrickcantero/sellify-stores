// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcceptForm } from "./accept-form";

const acceptOffer = vi.hoisted(() => vi.fn());
vi.mock("../../actions", () => ({ acceptOffer }));

describe("AcceptForm after a rejected submit", () => {
  beforeEach(() => {
    acceptOffer.mockReset();
    acceptOffer.mockResolvedValue({
      status: "error",
      fieldErrors: { email: "Enter an email like you@example.com." },
    });
  });

  async function submitWithBadEmail() {
    const user = userEvent.setup();
    render(<AcceptForm slug="shop" quoteId="q1" />);
    await user.type(screen.getByLabelText("Your name"), "Sam Byrne");
    await user.type(screen.getByLabelText("Phone number"), "085 123 4567");
    await user.type(screen.getByLabelText("Email"), "nope");
    await user.click(screen.getByRole("button", { name: "Accept offer" }));
  }

  it("keeps what the customer typed", async () => {
    await submitWithBadEmail();
    await screen.findByRole("alert");

    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Sam Byrne");
    expect((screen.getByLabelText("Phone number") as HTMLInputElement).value).toBe("085 123 4567");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("nope");
  });

  it("announces the error and marks only the invalid field", async () => {
    await submitWithBadEmail();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Enter an email like you@example.com.");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Your name").getAttribute("aria-invalid")).toBeNull();
  });

  it("announces an identical error again on a second submit", async () => {
    await submitWithBadEmail();
    const first = await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Accept offer" }));

    await waitFor(() => expect(screen.getByRole("alert")).not.toBe(first));
    expect(screen.getByRole("alert").textContent).toBe(first.textContent);
  });
});
