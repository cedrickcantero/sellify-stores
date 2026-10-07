// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Select } from "./select";

const conditions = [
  { value: "new", label: "New" },
  { value: "refurbished", label: "Refurbished" },
  { value: "used", label: "Used" },
];

function ConditionForm() {
  return (
    <form aria-label="Product">
      <label htmlFor="condition">Condition</label>
      <Select id="condition" name="condition" options={conditions} placeholder="Choose condition" />
    </form>
  );
}

function formValue(name: string): FormDataEntryValue | null {
  const form = screen.getByRole("form", { name: "Product" }) as HTMLFormElement;
  return new FormData(form).get(name);
}

describe("Select", () => {
  it("is a labelled combobox showing the placeholder", () => {
    render(<ConditionForm />);
    expect(screen.getByRole("combobox", { name: "Condition" })).toHaveTextContent(
      "Choose condition",
    );
  });

  it("can be opened, moved through and chosen with the keyboard only", async () => {
    const user = userEvent.setup();
    render(<ConditionForm />);

    await user.tab();
    const select = screen.getByRole("combobox", { name: "Condition" });
    expect(select).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Opening highlights the first option; one step down is the second.
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(select).toHaveTextContent("Refurbished");
    expect(select).toHaveFocus();
    expect(formValue("condition")).toBe("refurbished");
  });

  it("closes on Escape without changing the value", async () => {
    const user = userEvent.setup();
    render(<ConditionForm />);
    await user.tab();

    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Condition" })).toHaveTextContent(
      "Choose condition",
    );
  });
});
