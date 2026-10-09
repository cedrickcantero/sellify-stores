import { describe, expect, it } from "vitest";
import { answersSummary, formatEuros, parseEuros } from "./buyback-questions";

describe("parseEuros", () => {
  it("turns euro text into cents", () => {
    expect(parseEuros("250")).toBe(25000);
    expect(parseEuros("249.99")).toBe(24999);
    expect(parseEuros(" 12,50 ")).toBe(1250);
    expect(parseEuros("0")).toBe(0);
  });

  it("rejects empty, negative and non-numeric text", () => {
    expect(parseEuros("")).toBeNull();
    expect(parseEuros("abc")).toBeNull();
    expect(parseEuros("-5")).toBeNull();
    expect(parseEuros("1.234")).toBeNull();
  });
});

describe("formatEuros", () => {
  it("formats cents as euros", () => {
    expect(formatEuros(25000)).toBe("€250.00");
    expect(formatEuros(5)).toBe("€0.05");
  });
});

describe("answersSummary", () => {
  it("reads the three condition answers in plain words", () => {
    expect(answersSummary({ screen_cracked: true, battery_ok: false, powers_on: true })).toBe(
      "Screen cracked, battery needs replacing, turns on",
    );
    expect(answersSummary({ screen_cracked: false, battery_ok: true, powers_on: false })).toBe(
      "Screen not cracked, battery OK, does not turn on",
    );
  });

  it("skips answers that were not given", () => {
    expect(answersSummary({ powers_on: true })).toBe("Turns on");
  });
});
