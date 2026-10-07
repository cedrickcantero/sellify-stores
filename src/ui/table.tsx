import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/**
 * A list of records. Compose with TableHeader, TableBody, TableRow,
 * TableHead and TableCell like a plain HTML table. Wide tables scroll
 * sideways on phones inside the rounded frame. Use TableEmpty when there are
 * no rows.
 */
export function Table({
  className,
  caption,
  ...props
}: ComponentProps<"table"> & {
  /** Accessible name for the table; visually hidden. */
  caption?: string;
}) {
  return (
    // relative: keeps sr-only (absolute) header text inside the scroll frame,
    // so it cannot widen the page on phones.
    <div className="relative w-full overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className={cn("w-full caption-bottom text-body", className)} {...props}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {props.children}
      </table>
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-border bg-background", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-border transition-colors hover:bg-background", className)}
      {...props}
    />
  );
}

export function TableHead({
  className,
  align = "left",
  ...props
}: ComponentProps<"th"> & { align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-10 px-4 text-small font-semibold whitespace-nowrap text-muted-foreground",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  align = "left",
  ...props
}: ComponentProps<"td"> & {
  /** Right-align numbers and money. */
  align?: "left" | "right";
}) {
  return (
    <td
      className={cn(
        "h-12 px-4 py-2 align-middle text-foreground",
        align === "right" ? "text-right tabular-nums" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

/** One full-width row saying the table is empty, with an optional next step. */
export function TableEmpty({
  colSpan,
  children,
  action,
}: {
  colSpan: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-body text-muted-foreground">{children}</p>
          {action}
        </div>
      </td>
    </tr>
  );
}
