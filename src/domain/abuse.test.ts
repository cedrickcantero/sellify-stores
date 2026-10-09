import { describe, expect, it } from "vitest";
import { clientIp, HONEYPOT_FIELD, isHoneypotTripped, isRateLimitDisabled } from "./abuse";

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
  it("prefers x-real-ip, which Vercel sets and a client cannot prepend to", () => {
    expect(
      clientIp(new Headers({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "6.6.6.6, 198.51.100.2" })),
    ).toBe("198.51.100.2");
  });

  it("falls back to the first x-forwarded-for address, then to unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("isRateLimitDisabled", () => {
  it("is off unless RATE_LIMIT_DISABLED=1", () => {
    expect(isRateLimitDisabled({ NODE_ENV: "test" })).toBe(false);
    expect(isRateLimitDisabled({ NODE_ENV: "test", RATE_LIMIT_DISABLED: "true" })).toBe(false);
    expect(isRateLimitDisabled({ NODE_ENV: "development", RATE_LIMIT_DISABLED: "1" })).toBe(true);
  });

  it("is never honoured in production or on Vercel", () => {
    expect(isRateLimitDisabled({ NODE_ENV: "production", RATE_LIMIT_DISABLED: "1" })).toBe(false);
    expect(isRateLimitDisabled({ NODE_ENV: "development", VERCEL: "1", RATE_LIMIT_DISABLED: "1" })).toBe(false);
  });
});
