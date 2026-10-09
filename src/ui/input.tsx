import type { ComponentProps } from "react";
import { cn } from "./cn";

export const controlClasses =
  "w-full rounded-control border border-input bg-surface px-3 text-body text-foreground shadow-card placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error";

/** A single-line text, number, email or search field. Wrap in a Field for the label and error. */
export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        controlClasses,
        "h-10 file:mr-3 file:border-0 file:bg-transparent file:text-body file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

/** Multi-line text such as the store's about text. Wrap in a Field. */
export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(controlClasses, "py-2", className)} {...props} />;
}
