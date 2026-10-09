import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/**
 * A white surface that groups related content: a form section, a dashboard
 * tile, settings. Give it a title for a section heading.
 */
export function Card({
  title,
  description,
  actions,
  footer,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  /** Small actions at the top right, such as a ghost "View all" Button. */
  actions?: ReactNode;
  /** Actions at the bottom, right-aligned, such as Save. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const hasHeader = title || description || actions;
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-card",
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {title ? <h2 className="font-heading text-section text-foreground">{title}</h2> : null}
            {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
      {footer ? (
        <div className="-mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** A dashboard number tile: a label, one big value and an optional note. */
export function StatCard({
  label,
  value,
  note,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-1", className)}>
      <p className="text-body font-medium text-muted-foreground">{label}</p>
      <p className="font-heading text-page-title text-foreground">{value}</p>
      {note ? <div className="text-small text-muted-foreground">{note}</div> : null}
    </Card>
  );
}

/** Children in a responsive grid of equal columns: one on phones, up to `columns` on desktop. */
export function CardGrid({
  columns = 3,
  className,
  ...props
}: ComponentProps<"div"> & { columns?: 2 | 3 | 4 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };
  return <div className={cn("grid grid-cols-1 gap-4", cols[columns], className)} {...props} />;
}
