import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** The one main action of a page or modal. */
        primary: "bg-primary text-primary-foreground shadow-card hover:bg-primary-hover",
        /** Every other action next to a primary one. */
        secondary:
          "border border-input bg-surface text-foreground shadow-card hover:bg-surface-muted",
        /** Low-emphasis actions inside tables, toolbars and the shell. */
        ghost: "text-foreground hover:bg-surface-muted",
        /** Deletes or removes something. Confirm in a Modal first. */
        destructive: "bg-error text-primary-foreground shadow-card hover:bg-error-hover",
      },
      size: {
        md: "h-10 px-4 text-body",
        sm: "h-8 px-3 text-small",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (for example a Next.js Link) with button styles. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      // Buttons never submit a form by accident; pass type="submit" explicitly.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
