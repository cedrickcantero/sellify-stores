// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";

describe("Field", () => {
  it("labels its control and describes it with the hint and the error", () => {
    render(
      <Field label="Price" hint="In euros." error="Enter a price above 0.">
        <Input name="price" />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Price" });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("In euros. Enter a price above 0.");
  });

  it("keeps a description the control already had", () => {
    render(
      <>
        <p id="price-policy">Prices include VAT.</p>
        <Field label="Price" error="Enter a price above 0.">
          <Input name="price" aria-describedby="price-policy" />
        </Field>
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Price" })).toHaveAccessibleDescription(
      "Prices include VAT. Enter a price above 0.",
    );
  });

  it("is valid with no error", () => {
    render(
      <Field label="Title">
        <Input name="title" />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Title" })).toBeValid();
  });
});
