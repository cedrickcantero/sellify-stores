import { describe, expect, it } from "vitest";
import { clientIp, HONEYPOT_FIELD, isHoneypotTripped } from "./abuse";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

describe("isHoneypotTripped", () => {
  it("is not tripped when the hidden field is missing or empty", () => {
    expect(isHoneypotTripped(form({ name: "Aoife" }))).toBe(false);
    expect(isHoneypotTripped(form({ name: "Aoife", [HONEYPOT_FIELD]: "" }))).toBe(false);
  });

  it("is tripped when a bot fills the hidden field", () => {
    expect(isHoneypotTripped(form({ name: "Bot", [HONEYPOT_FIELD]: "https://spam.example" }))).toBe(true);
    expect(isHoneypotTripped(form({ [HONEYPOT_FIELD]: "  x " }))).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first address of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
