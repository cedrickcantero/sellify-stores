"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import { cn } from "./cn";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/**
 * Pick one value from a short fixed list (condition, repair type, slot
 * length). Keyboard: Tab to focus, Enter, Space or Arrow keys to open, Arrow
 * keys to move, Enter to choose, Escape to close. Works inside a plain form
 * through `name`. Wrap in a Field for the label and error.
 */
export function Select({
  options,
  placeholder = "Choose",
  className,
  ...props
}: {
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const { id, name, value, defaultValue, onValueChange, required, disabled } = props;
  return (
    <RadixSelect.Root
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      required={required}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        id={id}
        aria-invalid={props["aria-invalid"]}
        aria-describedby={props["aria-describedby"]}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-control border border-input bg-surface px-3 text-left text-body text-foreground shadow-card",
          "data-placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-error",
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-control border border-border bg-surface shadow-overlay"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex h-9 cursor-default items-center rounded-control pr-8 pl-3 text-body text-foreground outline-none select-none data-disabled:opacity-50 data-highlighted:bg-primary-tint data-highlighted:text-primary"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2 inline-flex">
                  <Check className="size-4" aria-hidden />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
