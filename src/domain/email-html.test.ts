import { describe, expect, it } from "vitest";
import { escapeHtml, safeHtml } from "./email-html";

describe("escapeHtml", () => {
  it("escapes the five HTML special characters", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });

  it("escapes an existing entity rather than passing it through", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves plain text alone", () => {
    expect(escapeHtml("Your repair is booked.")).toBe("Your repair is booked.");
  });
});

describe("safeHtml", () => {
  it("escapes every interpolated value and keeps the template markup", () => {
    const name = `<script>alert("x")</script>`;
    expect(safeHtml`<p>Hi ${name}, total ${12.5}</p>`).toBe(
      "<p>Hi &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;, total 12.5</p>",
    );
  });

  it("renders null and undefined as empty text", () => {
    expect(safeHtml`<p>${null}${undefined}</p>`).toBe("<p></p>");
  });
});
