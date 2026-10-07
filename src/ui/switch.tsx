"use client";

import { Switch as RadixSwitch } from "radix-ui";
import { useId, type ReactNode } from "react";

/**
 * An on/off setting that applies at once: store online, banner shown, a tab
 * visible. Space toggles it. Inside a form, `name` submits "on" when checked.
 */
export function Switch({
  label,
  description,
  id,
  ...props
}: {
  /** What the switch controls: "Store online", "Show banner". */
  label: ReactNode;
  description?: ReactNode;
  id?: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const generated = useId();
  const switchId = id ?? generated;
  const descriptionId = description ? `${switchId}-description` : undefined;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={switchId} className="text-body font-medium text-foreground">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-small text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <RadixSwitch.Root
        id={switchId}
        aria-describedby={descriptionId}
        className="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary"
        {...props}
      >
        <RadixSwitch.Thumb className="block size-5 rounded-full bg-surface shadow-card transition-transform data-[state=checked]:translate-x-5" />
      </RadixSwitch.Root>
    </div>
  );
}
