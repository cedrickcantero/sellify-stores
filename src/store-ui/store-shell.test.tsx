import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultStoreConfig, StoreConfig } from "@/domain/store-config";
import { StoreHome } from "./store-home";
import { StoreShell } from "./store-shell";

// next/font only works inside the Next.js build.
vi.mock("./fonts", () => ({ storeFontVariables: "" }));

function config(patch: Record<string, unknown> = {}): StoreConfig {
  return StoreConfig.parse({ ...defaultStoreConfig("FixIt Galway"), ...patch });
}

function home(c: StoreConfig): string {
  return renderToStaticMarkup(<StoreHome config={c} basePath="/s/fixit" />);
}

function shell(c: StoreConfig): string {
  return renderToStaticMarkup(
    <StoreShell config={c} basePath="/s/fixit">
      <p>page</p>
    </StoreShell>,
  );
}

describe("store banner", () => {
  it("shows the banner text only when the banner is on", () => {
    const on = config({ content: { banner: { enabled: true, text: "Free screen check this week" }, about: "" } });
    expect(shell(on)).toContain("Free screen check this week");

    const off = config({ content: { banner: { enabled: false, text: "Free screen check this week" }, about: "" } });
    expect(shell(off)).not.toContain("Free screen check this week");
  });

  it("shows nothing when the banner is on but has no text", () => {
    const empty = config({ content: { banner: { enabled: true, text: "" }, about: "" } });
    expect(shell(empty)).not.toContain('role="region"');
  });
});

describe("store home", () => {
  it("renders the about text as plain text, not markup", () => {
    const html = home(config({ content: { banner: { enabled: false, text: "" }, about: "Hello <b>there</b>" } }));
    expect(html).toContain("Hello &lt;b&gt;there&lt;/b&gt;");
  });

  it("lists opening hours per weekday and marks closed days", () => {
    const html = home(
      config({
        openingHours: {
          mon: { open: "09:00", close: "17:30" },
          tue: { open: "09:00", close: "18:00" },
          wed: { open: "09:00", close: "18:00" },
          thu: { open: "09:00", close: "18:00" },
          fri: { open: "09:00", close: "18:00" },
          sat: { open: "10:00", close: "16:00" },
          sun: null,
        },
      }),
    );
    expect(html).toContain("Monday");
    expect(html).toContain("09:00 to 17:30");
    expect(html).toMatch(/Sunday<\/dt><dd[^>]*>Closed/);
  });

  it("omits the about section when there is no about text", () => {
    expect(home(config())).not.toContain("About us");
  });

  it("uses only store variables for colour", () => {
    const html = home(config({ content: { banner: { enabled: true, text: "Hi" }, about: "About" } }));
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
