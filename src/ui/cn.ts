import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge has to know the custom token classes, or it would treat
// text-page-title as a colour and drop it when text-foreground follows.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["page-title", "section", "body", "small"],
      radius: ["control", "card"],
      shadow: ["card", "overlay"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
