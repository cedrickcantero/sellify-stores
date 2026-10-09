// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "./alert";
import { Input } from "./input";
import { STATUS_LIST, StatusBadge, type Status } from "./status-badge";
import { Switch } from "./switch";

// WCAG AA contrast, computed from the token values in globals.css and the
// token classes the components actually render: 4.5:1 for text, 3:1 for
// control borders and the switch track (WCAG 1.4.11).
// Vitest runs from the repo root.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const tokens = new Map(
  [...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]),
);

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`No hex value for --${name} in globals.css :root`);
  return value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The colour token behind a utility class on the element, e.g. text-* or bg-*.
const NON_COLOUR = new Set(["text-small", "text-body", "text-section", "text-page-title"]);
function classToken(el: Element, prefix: "text" | "bg" | "border"): string {
  const cls = [...el.classList].find(
    (c) => c.startsWith(`${prefix}-`) && !NON_COLOUR.has(c) && !c.includes(":"),
  );
  if (!cls) throw new Error(`No ${prefix}-* colour class on ${el.outerHTML}`);
  return token(cls.slice(prefix.length + 1));
}

describe("contrast", () => {
  it.each(STATUS_LIST)("StatusBadge %s text meets 4.5:1 on its tint", (status: Status) => {
    render(<StatusBadge status={status} />);
    const badge = document.querySelector("[data-tone]")!;
    expect(contrast(classToken(badge, "text"), classToken(badge, "bg"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["error", "success", "warning", "info"] as const)(
    "Alert %s text meets 4.5:1 on its tint",
    (tone) => {
      render(<Alert tone={tone}>Enter your email and password.</Alert>);
      const alert = screen.getByText("Enter your email and password.").closest("[data-tone]")!;
      expect(contrast(classToken(alert, "text"), classToken(alert, "bg"))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("Input border meets 3:1 on the surface and the page background", () => {
    render(<Input aria-label="Title" />);
    const border = classToken(screen.getByRole("textbox"), "border");
    expect(contrast(border, token("surface"))).toBeGreaterThanOrEqual(3);
    expect(contrast(border, token("background"))).toBeGreaterThanOrEqual(3);
  });

  it("Switch off track meets 3:1 on the surface", () => {
    render(<Switch label="Store online" />);
    const track = classToken(screen.getByRole("switch"), "bg");
    expect(contrast(track, token("surface"))).toBeGreaterThanOrEqual(3);
  });
});
