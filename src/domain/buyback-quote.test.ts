import { describe, expect, it } from "vitest";
import type { BuybackDeduction } from "@/data";
import { quoteBuyback } from "./buyback-quote";

const ALL_GOOD = { screen_cracked: false, battery_ok: true, powers_on: true };
const rule = (
  questionKey: BuybackDeduction["questionKey"],
  answer: boolean,
  kind: BuybackDeduction["kind"],
  value: number,
): BuybackDeduction => ({ questionKey, answer, kind, value });

describe("quoteBuyback", () => {
  it("returns the base price when no rule matches", () => {
    expect(quoteBuyback(30000, [], ALL_GOOD)).toBe(30000);
    expect(quoteBuyback(30000, [rule("screen_cracked", true, "amount", 5000)], ALL_GOOD)).toBe(30000);
  });

  it("takes off a single matching deduction", () => {
    const answers = { ...ALL_GOOD, screen_cracked: true };
    expect(quoteBuyback(30000, [rule("screen_cracked", true, "amount", 5000)], answers)).toBe(25000);
  });

  it("stacks every matching deduction", () => {
    const answers = { screen_cracked: true, battery_ok: false, powers_on: true };
    const rules = [
      rule("screen_cracked", true, "amount", 5000),
      rule("battery_ok", false, "amount", 2000),
      rule("powers_on", false, "amount", 9999),
    ];
    expect(quoteBuyback(30000, rules, answers)).toBe(23000);
  });

  it("makes the offer a matching floor, ignoring deductions", () => {
    const answers = { screen_cracked: true, battery_ok: true, powers_on: false };
    const rules = [rule("screen_cracked", true, "amount", 5000), rule("powers_on", false, "floor", 3000)];
    expect(quoteBuyback(30000, rules, answers)).toBe(3000);
  });

  it("uses the lowest of several matching floors", () => {
    const answers = { screen_cracked: true, battery_ok: true, powers_on: false };
    const rules = [rule("screen_cracked", true, "floor", 8000), rule("powers_on", false, "floor", 3000)];
    expect(quoteBuyback(30000, rules, answers)).toBe(3000);
  });

  it("clamps at zero when deductions exceed the price", () => {
    const answers = { screen_cracked: true, battery_ok: false, powers_on: true };
    const rules = [rule("screen_cracked", true, "amount", 20000), rule("battery_ok", false, "amount", 20000)];
    expect(quoteBuyback(30000, rules, answers)).toBe(0);
  });
});
