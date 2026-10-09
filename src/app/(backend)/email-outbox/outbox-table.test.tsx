// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OutboxTable, type OutboxRow } from "./outbox-table";

const row: OutboxRow = {
  id: "1",
  kindLabel: "Order confirmation",
  recipient: "sam@example.com",
  subject: "Your order",
  body: "<p>Thanks for your order.</p>",
  status: "failed",
  error: "Email is not set up: RESEND_API_KEY is not set.",
  sentAt: "9 Oct 2026, 10:00",
};

describe("OutboxTable", () => {
  it("lists kind, recipient, subject, time and status", () => {
    render(<OutboxTable rows={[row]} />);
    expect(screen.getByText("Order confirmation")).toBeTruthy();
    expect(screen.getByText("sam@example.com")).toBeTruthy();
    expect(screen.getByText("9 Oct 2026, 10:00")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
  });

  it("opens the body in a sandboxed frame when the subject is clicked", async () => {
    render(<OutboxTable rows={[row]} />);
    await userEvent.click(screen.getByRole("button", { name: /Your order/ }));

    const frame = screen.getByTitle("Body of Your order");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toBe(row.body);
    expect(screen.getByText(/RESEND_API_KEY/)).toBeTruthy();
  });

  it("says so when there are no emails", () => {
    render(<OutboxTable rows={[]} />);
    expect(screen.getByText(/No emails yet/)).toBeTruthy();
  });
});
