import type { ReactNode } from "react";
import { cn } from "./cn";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

// One label and one tone per record status across the product: sales,
// repair tickets, buyback quotes, emails, custom domains, the store and
// product stock. Add a status here rather than overriding a label on a page.
const STATUSES = {
  // Sales
  completed: { label: "Completed", tone: "success" },
  needs_refund: { label: "Needs refund", tone: "error" },
  // Repair tickets
  booked: { label: "Booked", tone: "info" },
  in_progress: { label: "In progress", tone: "warning" },
  done: { label: "Done", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  // Buyback quotes
  quoted: { label: "Quoted", tone: "neutral" },
  accepted: { label: "Accepted", tone: "info" },
  received: { label: "Received", tone: "success" },
  // Email outbox
  sent: { label: "Sent", tone: "success" },
  failed: { label: "Failed", tone: "error" },
  // Custom domains
  pending: { label: "Pending", tone: "warning" },
  verified: { label: "Connected", tone: "success" },
  error: { label: "Error", tone: "error" },
  // Store
  online: { label: "Online", tone: "success" },
  offline: { label: "Offline", tone: "neutral" },
  // Product stock
  in_stock: { label: "In stock", tone: "success" },
  sold_out: { label: "Sold out", tone: "warning" },
} as const satisfies Record<string, { label: string; tone: StatusTone }>;

export type Status = keyof typeof STATUSES;

/** Every status, in display order. */
export const STATUS_LIST = Object.keys(STATUSES) as Status[];

const toneClasses: Record<StatusTone, { badge: string; dot: string }> = {
  // Text uses the darker *-text tokens (4.5:1 on the tint); dots keep the
  // base status colour.
  success: { badge: "bg-success-tint text-success-text", dot: "bg-success" },
  warning: { badge: "bg-warning-tint text-warning-text", dot: "bg-warning" },
  error: { badge: "bg-error-tint text-error-text", dot: "bg-error" },
  info: { badge: "bg-primary-tint text-primary", dot: "bg-primary" },
  neutral: { badge: "bg-surface-muted text-secondary-foreground", dot: "bg-muted-foreground" },
};

/** The state of a record. Pass the record's status; the label and colour follow. */
export function StatusBadge({
  status,
  children,
  className,
}: {
  status: Status;
  /** Overrides the standard label; the tone stays tied to the status. */
  children?: ReactNode;
  className?: string;
}) {
  const { label, tone } = STATUSES[status];
  const classes = toneClasses[tone];
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-small font-medium whitespace-nowrap",
        classes.badge,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", classes.dot)} />
      {children ?? label}
    </span>
  );
}
