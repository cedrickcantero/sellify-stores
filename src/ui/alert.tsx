import type { ReactNode } from "react";
import { cn } from "./cn";

export type AlertTone = "error" | "success" | "warning" | "info";

const toneClasses: Record<AlertTone, string> = {
  error: "border-error bg-error-tint text-error-text",
  success: "border-success bg-success-tint text-success-text",
  warning: "border-warning bg-warning-tint text-warning-text",
  info: "border-primary-border bg-primary-tint text-primary",
};

/**
 * A one-sentence message about the whole form or page: "Wrong email or
 * password.", "Store published." Errors are announced to screen readers.
 * For an error on one field use Field's `error` instead.
 */
export function Alert({
  tone,
  children,
  className,
}: {
  tone: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      data-tone={tone}
      className={cn("rounded-control border px-3 py-2 text-body", toneClasses[tone], className)}
    >
      {children}
    </p>
  );
}
