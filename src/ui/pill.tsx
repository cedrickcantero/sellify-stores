import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

// One pill size everywhere. FilterBar uses the same classes for its toggle
// pills, so a filter pill and a label pill always match.
export const pillVariants = cva(
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-small font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface text-foreground",
        primary: "border-primary-border bg-primary-tint text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/**
 * A short label for a category, not a state: a sale's channel (POS, Online),
 * a product kind, a tab name. For a record's state use StatusBadge.
 */
export function Pill({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof pillVariants>) {
  return <span className={cn(pillVariants({ tone }), className)} {...props} />;
}
