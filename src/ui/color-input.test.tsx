// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ColorInput } from "./color-input";
import { Field } from "./field";

function Harness({ initial = "#1f2937", error }: { initial?: string; error?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Field label="Primary colour" error={error}>
        <ColorInput value={value} onChange={setValue} />
      </Field>
      <output data-testid="value">{value}</output>
    </>
  );
}

describe("ColorInput", () => {
  it("is labelled by its Field and shows the hex code", () => {
    render(<Harness error="Enter a colour like #0F766E." />);
    const hex = screen.getByRole("textbox", { name: "Primary colour" });
    expect(hex).toHaveValue("#1f2937");
    expect(hex).toBeInvalid();
    expect(hex).toHaveAccessibleDescription("Enter a colour like #0F766E.");
  });

  it("changes the value when a hex code is typed, even a half-typed one", async () => {
    render(<Harness />);
    const hex = screen.getByRole("textbox", { name: "Primary colour" });
    await userEvent.clear(hex);
    await userEvent.type(hex, "#0F76");
    expect(screen.getByTestId("value")).toHaveTextContent("#0F76");
  });

  it("changes the value when a colour is picked", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Pick a colour"), { target: { value: "#0f766e" } });
    expect(screen.getByTestId("value")).toHaveTextContent("#0f766e");
  });

  it("keeps the picker on a valid colour while the hex code is incomplete", async () => {
    render(<Harness />);
    const hex = screen.getByRole("textbox", { name: "Primary colour" });
    await userEvent.clear(hex);
    await userEvent.type(hex, "teal");
    expect(screen.getByLabelText("Pick a colour")).toHaveValue("#1f2937");
  });
});
