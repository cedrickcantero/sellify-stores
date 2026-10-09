// Server-side clean-up of an uploaded SVG before it is stored. Logos are
// only ever rendered through <img> (where SVG cannot run script), but the
// stored file can also be opened directly, so it must be harmless on its own.
//
// This is an allowlist rebuild, not a search and replace: the markup is
// tokenised and only SVG drawing elements and safe attributes are written
// back out. Removed: script, style, foreignObject and any element not on the
// list (with all of its content), event handler attributes, javascript: and
// other script URLs (also when entity encoded), every reference to anything
// outside the file (href, src and url() must point to "#id"; an <image> may
// also embed a PNG, JPEG, GIF or WebP data URL), comments, processing
// instructions, CDATA and the doctype with its entities. href and src are
// judged by local name whatever their prefix, CSS escapes (a backslash),
// image-set() and src() are refused, and only the SVG and xlink namespace
// declarations are kept. Returns null when
// the input has no <svg> root element.

const ALLOWED_ELEMENTS = new Set(
  [
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan", "textPath", "defs", "linearGradient", "radialGradient", "stop",
    "clipPath", "mask", "pattern", "symbol", "use", "title", "desc", "image", "marker",
    "filter", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite",
    "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight",
    "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR",
    "feGaussianBlur", "feMerge", "feMergeNode", "feMorphology", "feOffset",
    "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence",
  ].map((name) => name.toLowerCase()),
);

// Local names (after any prefix) of attributes that point at a resource.
const REFERENCE_ATTRIBUTES = new Set(["href", "src"]);
const ALLOWED_NAMESPACES = new Set(["http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink"]);
const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i;
const ATTRIBUTE_NAME = /^[a-zA-Z_][-a-zA-Z0-9_.]*(:[a-zA-Z_][-a-zA-Z0-9_.]*)?$/;
const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", colon: ":", tab: "\t", newline: "\n",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

// What a URL parser would see: entities decoded, whitespace and control
// characters removed, lower case.
function normalised(value: string): string {
  return decodeEntities(value).replace(/[\s\u0000-\u001f\u007f]+/g, "").toLowerCase();
}

function isLocalReference(value: string): boolean {
  return value.startsWith("#");
}

function urlsAreLocal(value: string): boolean {
  for (const match of value.matchAll(/url\(([^)]*)\)?/g)) {
    const target = match[1].replace(/^["']|["']$/g, "");
    if (!isLocalReference(target)) return false;
  }
  return true;
}

function isSafeAttribute(element: string, name: string, rawValue: string): boolean {
  const lower = name.toLowerCase();
  if (!ATTRIBUTE_NAME.test(name)) return false;
  // Any prefix can be bound to the xlink namespace, so judge by local name.
  const local = lower.includes(":") ? lower.slice(lower.indexOf(":") + 1) : lower;
  if (local.startsWith("on")) return false;
  const value = normalised(rawValue);

  if (lower === "xmlns" || lower.startsWith("xmlns:")) return ALLOWED_NAMESPACES.has(value);
  if (REFERENCE_ATTRIBUTES.has(local)) {
    if (isLocalReference(value)) return true;
    return element === "image" && SAFE_DATA_IMAGE.test(value);
  }
  // A backslash is a CSS escape (u\72l( is url(); refuse rather than decode.
  if (value.includes("\\")) return false;
  if (/(javascript|vbscript|livescript|data):/.test(value)) return false;
  if (/expression\(|@import|behavior:|-moz-binding|image-set\(|(^|[^a-z-])src\(/.test(value)) return false;
  return urlsAreLocal(value);
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  // Only the five XML entities and numeric references survive: the doctype
  // that could define others is removed.
  return value
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
    .replace(/>/g, "&gt;");
}

function cleanAttributes(element: string, source: string): string {
  let out = "";
  const seen = new Set<string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    if (!isSafeAttribute(element, name, value)) continue;
    out += ` ${name}="${escapeAttribute(value)}"`;
  }
  return out;
}

// The local element name for an SVG element (an "svg:" prefix is dropped),
// or null for anything in another namespace.
function localName(qualified: string): string | null {
  const parts = qualified.split(":");
  if (parts.length === 1) return qualified;
  return parts.length === 2 && parts[0].toLowerCase() === "svg" ? parts[1] : null;
}

// Index just past the ">" that ends a tag starting at `start`, skipping ">"
// inside quoted attribute values.
function endOfTag(input: string, start: number): number {
  let quote: string | null = null;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return i + 1;
    }
  }
  return input.length;
}

function skipPast(input: string, start: number, terminator: string): number {
  const index = input.indexOf(terminator, start);
  return index === -1 ? input.length : index + terminator.length;
}

type Open = { name: string; local: string | null; kept: boolean };

export function sanitizeSvg(input: string): string | null {
  const stack: Open[] = [];
  let out = "";
  let sawRoot = false;
  let i = 0;

  const dropping = () => stack.length > 0 && !stack[stack.length - 1].kept;

  while (i < input.length) {
    if (input.startsWith("<!--", i)) {
      i = skipPast(input, i + 4, "-->");
    } else if (input.startsWith("<![CDATA[", i)) {
      i = skipPast(input, i + 9, "]]>");
    } else if (input.startsWith("<!", i)) {
      // A doctype, possibly with an internal subset of entity declarations.
      const close = input.indexOf(">", i);
      const bracket = input.indexOf("[", i);
      i = bracket !== -1 && (close === -1 || bracket < close) ? skipPast(input, skipPast(input, bracket, "]"), ">") : skipPast(input, i, ">");
    } else if (input.startsWith("<?", i)) {
      i = skipPast(input, i + 2, "?>");
    } else if (input.startsWith("</", i)) {
      const end = endOfTag(input, i);
      const name = input.slice(i + 2, end - 1).trim().toLowerCase();
      i = end;
      const index = stack.map((o) => o.name).lastIndexOf(name);
      if (index === -1) continue;
      const closing = stack.splice(index);
      for (let k = closing.length - 1; k >= 0; k--) {
        if (closing[k].kept) out += `</${closing[k].local}>`;
      }
      if (stack.length === 0 && sawRoot) break;
    } else if (input[i] === "<" && /[a-zA-Z]/.test(input[i + 1] ?? "")) {
      const end = endOfTag(input, i);
      const body = input.slice(i + 1, end - 1);
      i = end;
      const selfClosing = body.trimEnd().endsWith("/");
      const nameMatch = /^[^\s/>]+/.exec(body);
      if (!nameMatch) continue;
      const qualified = nameMatch[0];
      const local = localName(qualified);

      if (!sawRoot) {
        if (local?.toLowerCase() !== "svg") return null;
        sawRoot = true;
      }

      const kept = !dropping() && local !== null && ALLOWED_ELEMENTS.has(local.toLowerCase());
      if (kept) {
        const attributes = cleanAttributes(local.toLowerCase(), body.slice(qualified.length).replace(/\/\s*$/, ""));
        out += `<${local}${attributes}${selfClosing ? "/" : ""}>`;
      }
      if (!selfClosing) stack.push({ name: qualified.toLowerCase(), local, kept });
      else if (stack.length === 0) break;
    } else {
      const next = input.indexOf("<", i + 1);
      const end = next === -1 ? input.length : next;
      const text = input.slice(i, end);
      i = end;
      if (sawRoot && stack.length > 0 && !dropping()) out += escapeText(text.replace(/</g, "&lt;"));
    }
  }

  if (!sawRoot) return null;
  for (let k = stack.length - 1; k >= 0; k--) {
    if (stack[k].kept) out += `</${stack[k].local}>`;
  }
  return out;
}
