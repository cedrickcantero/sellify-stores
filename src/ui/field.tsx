import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

type ControlProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Label, optional hint and field error around one control (Input, Textarea,
 * Select). Wires the label, `aria-invalid` and `aria-describedby` onto the
 * control (adding to any description the control already has).
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** The field error from validation, in plain words: "Enter a price above 0." */
  error?: string;
  children: ReactElement<ControlProps>;
  className?: string;
}) {
  const generated = useId();
  const control = isValidElement(children) ? children : null;
  const id = control?.props.id ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  // Keep any description the control already had, then the hint and error.
  const describedBy =
    [control?.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body font-medium text-foreground">
        {label}
      </label>
      {control
        ? cloneElement(control, {
            id,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": describedBy,
          })
        : children}
      {hint ? (
        <p id={hintId} className="text-small text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-small font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
