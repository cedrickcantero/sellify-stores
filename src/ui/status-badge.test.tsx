// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge, type Status } from "./status-badge";

// Every record status in the product maps to one label and one tone, so a
// status looks the same on every page.
const cases: [Status, string, "success" | "warning" | "error" | "info" | "neutral"][] = [
  ["completed", "Completed", "success"],
  ["needs_refund", "Needs refund", "error"],
  ["booked", "Booked", "info"],
  ["in_progress", "In progress", "warning"],
  ["done", "Done", "success"],
  ["cancelled", "Cancelled", "neutral"],
  ["quoted", "Quoted", "neutral"],
  ["accepted", "Accepted", "info"],
  ["received", "Received", "success"],
  ["sent", "Sent", "success"],
  ["failed", "Failed", "error"],
  ["pending", "Pending", "warning"],
  ["verified", "Connected", "success"],
  ["error", "Error", "error"],
  ["online", "Online", "success"],
  ["offline", "Offline", "neutral"],
  ["in_stock", "In stock", "success"],
  ["sold_out", "Sold out", "warning"],
];

describe("StatusBadge", () => {
  it.each(cases)("shows %s as %s with the %s tone", (status, label, tone) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(label);
    expect(badge.closest("[data-tone]")).toHaveAttribute("data-tone", tone);
  });

  it("lets a page override the label but keeps the tone", () => {
    render(<StatusBadge status="needs_refund">Refund due</StatusBadge>);
    expect(screen.getByText("Refund due").closest("[data-tone]")).toHaveAttribute(
      "data-tone",
      "error",
    );
  });
});
