// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ saveDeductions: vi.fn() }));

import { DeductionForm } from "./deduction-form";

describe("DeductionForm", () => {
  it("names each rule and amount control after its answer", () => {
    render(<DeductionForm initial={{}} />);
    const rules = screen.getAllByRole("combobox");
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      // Set directly, so the name does not depend on a <label for> lookup.
      expect(rule).toHaveAttribute("aria-label", expect.stringMatching(/^Rule for .+/));
    }
    expect(screen.getByRole("combobox", { name: "Rule for Screen cracked" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Amount for Screen cracked" })).toHaveAttribute(
      "aria-label",
      "Amount for Screen cracked",
    );
  });
});
