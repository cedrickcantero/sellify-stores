"use client";

import { useState } from "react";
import { cn } from "./cn";
import { Input } from "./input";

const FULL_HEX = /^#[0-9a-fA-F]{6}$/;
// A colour picker always needs some value; this is data, not a styling colour.
// eslint-disable-next-line no-restricted-syntax -- initial value of a native colour input, not a style
const NO_COLOUR = "#000000";

/**
 * A colour as a picker plus its hex code, for brand colours. Controlled:
 * `value` is the hex code and `onChange` gets whatever is typed (it may be
 * incomplete; the server reports it as a field error). Wrap in a Field: the
 * Field's label names the hex input, which carries the id and error wiring.
 */
export function ColorInput({
  value,
  onChange,
  label = "colour",
  className,
  ...props
}: {
  /** Names the picker for screen readers: "<label> picker". Pass the Field's label. */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  // The picker needs a full code; while the hex is incomplete it keeps the
  // last full one.
  const [picked, setPicked] = useState(FULL_HEX.test(value) ? value.toLowerCase() : NO_COLOUR);
  if (FULL_HEX.test(value) && value.toLowerCase() !== picked) setPicked(value.toLowerCase());

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        type="color"
        aria-label={`${label} picker`}
        value={picked}
        onChange={(event) => onChange(event.target.value)}
        disabled={props.disabled}
        className="size-10 shrink-0 cursor-pointer p-1"
      />
      <Input
        {...props}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoComplete="off"
        maxLength={7}
        className="font-mono"
      />
    </div>
  );
}
