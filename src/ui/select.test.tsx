// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { useActionState, useState } from "react";
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

// A form action that always fails validation, like "Enter a price above 0."
// React 19 resets the form after every action, which must not clear choices.
function FailingActionForm({ controlled }: { controlled?: boolean }) {
  // Like the real actions: the error comes back with the values that were typed.
  const [state, action] = useActionState(
    async (_previous: { error: string; price: string }, formData: FormData) => {
      submitted.push(Object.fromEntries(formData) as Record<string, string>);
      return { error: "Enter a price above 0.", price: String(formData.get("price")) };
    },
    { error: "", price: "" },
  );
  const [kind, setKind] = useState("");
  return (
    <form aria-label="Product" action={action}>
      <label htmlFor="kind">Kind</label>
      {controlled ? (
        <Select id="kind" name="kind" options={conditions} value={kind} onValueChange={setKind} />
      ) : (
        <Select id="kind" name="kind" options={conditions} />
      )}
      <label htmlFor="condition">Condition</label>
      <Select id="condition" name="condition" options={conditions} defaultValue="new" />
      <label htmlFor="price">Price</label>
      <input id="price" name="price" defaultValue={state.price} />
      <p role="alert">{state.error}</p>
      <button type="submit">Save</button>
    </form>
  );
}

const submitted: Record<string, string>[] = [];

describe("Select inside a form action", () => {
  for (const controlled of [false, true]) {
    it(`keeps its choices and the typed text after a failed submit (${controlled ? "controlled" : "uncontrolled"})`, async () => {
      submitted.length = 0;
      const user = userEvent.setup();
      render(<FailingActionForm controlled={controlled} />);

      await user.click(screen.getByRole("combobox", { name: "Kind" }));
      await user.click(screen.getByRole("option", { name: "Used" }));
      await user.click(screen.getByRole("combobox", { name: "Condition" }));
      await user.click(screen.getByRole("option", { name: "Refurbished" }));
      await user.type(screen.getByLabelText("Price"), "25.0025.00");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Enter a price above 0.");
      expect(screen.getByRole("combobox", { name: "Kind" })).toHaveTextContent("Used");
      expect(screen.getByRole("combobox", { name: "Condition" })).toHaveTextContent("Refurbished");
      expect(screen.getByLabelText("Price")).toHaveValue("25.0025.00");

      // The next submit still carries the choices.
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(submitted).toHaveLength(2));
      expect(submitted[1]).toMatchObject({ kind: "used", condition: "refurbished" });
    });
  }
});
