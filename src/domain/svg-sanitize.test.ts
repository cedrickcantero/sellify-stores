import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "./svg-sanitize";

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`;

describe("sanitizeSvg", () => {
  it("keeps a plain wordmark as it is drawn", () => {
    const out = sanitizeSvg(
      wrap('<g fill="#0F766E"><path d="M0 0h10v10z"/><text x="1" y="8" font-family="Roboto Slab">FixIt</text></g>'),
    );
    expect(out).toContain('<path d="M0 0h10v10z"/>');
    expect(out).toContain(">FixIt</text>");
    expect(out).toContain('fill="#0F766E"');
    expect(out?.startsWith("<svg")).toBe(true);
  });

  it("keeps the case of mixed-case element names when closing them", () => {
    const out = sanitizeSvg(wrap('<linearGradient id="g"><stop offset="1"/></linearGradient>'));
    expect(out).toContain('<linearGradient id="g"><stop offset="1"/></linearGradient>');
  });

  it("closes elements the upload left open", () => {
    expect(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><g><rect/>')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"><g><rect/></g></svg>',
    );
  });

  it("removes script elements and their content", () => {
    const out = sanitizeSvg(wrap('<script>alert(1)</script><script type="x"><![CDATA[alert(2)]]></script><rect/>'));
    expect(out).not.toMatch(/script|alert/i);
    expect(out).toContain("<rect/>");
  });

  it("removes script elements written in any case or with a namespace prefix", () => {
    const out = sanitizeSvg(wrap("<SCRIPT>alert(1)</SCRIPT><svg:script>alert(2)</svg:script>"));
    expect(out).not.toMatch(/script|alert/i);
  });

  it("removes event handler attributes", () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect ONCLICK=\'alert(2)\' onmouseover=alert(3) width="5"/></svg>',
    );
    expect(out).not.toMatch(/on\w+=|alert/i);
    expect(out).toContain('width="5"');
  });

  it("removes javascript: URLs, also when entity encoded", () => {
    const out = sanitizeSvg(
      wrap(
        '<image href="javascript:alert(1)"/><use xlink:href=" &#106;avascript:alert(2)"/><image href="java&#x09;script:alert(3)"/><rect style="background:url(javascript:alert(4))"/>',
      ),
    );
    expect(out).not.toMatch(/javascript|alert|&#/i);
    expect(out).toContain("<image/>");
  });

  it("keeps an embedded raster image but not an embedded svg document", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const out = sanitizeSvg(wrap(`<image href="${png}"/><image href="data:image/svg+xml;base64,PHN2Zz4="/>`));
    expect(out).toContain(`<image href="${png}"/>`);
    expect(out).not.toContain("image/svg+xml");
  });

  it("treats href and src under any namespace prefix as references", () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:foo="http://www.w3.org/1999/xlink">' +
        '<image foo:href="https://evil.example/a.png"/><use bar:src="https://evil.example/b"/><use foo:href="#ok"/></svg>',
    );
    expect(out).not.toContain("evil.example");
    expect(out).toContain('<use foo:href="#ok"/>');
  });

  it("removes CSS-escaped url(), image-set() and src() references", () => {
    const out = sanitizeSvg(
      wrap(
        '<rect style="fill: u\\72l(https://evil.example/a)"/>' +
          '<rect style="background: image-set(&quot;https://evil.example/b.png&quot; 1x)"/>' +
          '<rect style="mask: src(https://evil.example/c)"/><rect style="fill: red"/>',
      ),
    );
    expect(out).not.toMatch(/evil\.example|image-set|src\(|\\/);
    expect(out).toContain('<rect style="fill: red"/>');
  });

  it("keeps only the SVG and xlink namespace declarations", () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:e="https://evil.example/ns"><rect/></svg>',
    );
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect/></svg>',
    );
  });

  it("removes foreignObject and everything inside it", () => {
    const out = sanitizeSvg(
      wrap('<foreignObject width="10"><body xmlns="http://www.w3.org/1999/xhtml"><iframe src="https://evil.example"/></body></foreignObject><circle r="1"/>'),
    );
    expect(out).not.toMatch(/foreignObject|iframe|evil|body/i);
    expect(out).toContain('<circle r="1"/>');
  });

  it("removes external references but keeps references inside the file", () => {
    const out = sanitizeSvg(
      wrap(
        '<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>' +
          '<use href="#g"/><use xlink:href="https://evil.example/sprite.svg#x"/>' +
          '<image href="https://evil.example/track.png"/><rect fill="url(#g)"/><rect fill="url(https://evil.example/x)"/>' +
          '<rect style="fill: url(https://evil.example/y)"/>',
      ),
    );
    expect(out).not.toContain("evil.example");
    expect(out).toContain('<use href="#g"/>');
    expect(out).toContain('<rect fill="url(#g)"/>');
  });

  it("removes style elements, comments, processing instructions and doctype entities", () => {
    const out = sanitizeSvg(
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><!-- note -->' +
        wrap('<style>@import url(https://evil.example/a.css);</style><text>&x;</text>'),
    );
    expect(out).not.toMatch(/DOCTYPE|ENTITY|passwd|<style|@import|note|<\?xml/);
    expect(out?.startsWith("<svg")).toBe(true);
  });

  it("removes elements that are not SVG drawing elements", () => {
    const out = sanitizeSvg(wrap('<iframe src="x"></iframe><embed src="x"/><object data="x"></object><rect/>'));
    expect(out).not.toMatch(/iframe|embed|object/);
    expect(out).toContain("<rect/>");
  });

  it("escapes attribute values so they cannot break out of the tag", () => {
    const out = sanitizeSvg(wrap("<rect class='a\"onload=\"alert(1)'/>"));
    expect(out).not.toMatch(/"onload=/);
  });

  it("returns null when there is no svg root element", () => {
    expect(sanitizeSvg("<html><body>hi</body></html>")).toBeNull();
    expect(sanitizeSvg("<script>alert(1)</script>")).toBeNull();
  });
});
