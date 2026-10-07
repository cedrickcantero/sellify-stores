"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * A dialog over the page for create, edit and confirm steps. Traps focus,
 * closes on Escape, the close icon or a ModalClose, and returns focus to the
 * trigger. Pass `trigger` for an uncontrolled modal, or `open` and
 * `onOpenChange` to control it (for example to close after a save).
 */
export function Modal({
  trigger,
  title,
  description,
  footer,
  children,
  open,
  onOpenChange,
  size = "md",
}: {
  /** The element that opens the modal, usually a Button. */
  trigger?: ReactNode;
  /** Short, verb-led: "Add product", "Remove product?" */
  title: string;
  description?: ReactNode;
  /** Actions, right-aligned: a secondary ModalClose then the primary action. */
  footer?: ReactNode;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** md for forms (512px), sm for confirmations (400px). */
  size?: "sm" | "md";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <Dialog.Content
          // Without a description Radix warns unless aria-describedby is unset.
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-border bg-surface shadow-overlay",
            size === "sm" ? "max-w-100" : "max-w-128",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-heading text-section text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-body text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mt-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Wrap a Button to close the modal when clicked: `<ModalClose asChild><Button variant="secondary">Cancel</Button></ModalClose>`. */
export const ModalClose = Dialog.Close;
