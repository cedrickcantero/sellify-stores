const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Escapes text for use inside HTML element content or a quoted attribute.
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

// Tagged template for email bodies: the template's own markup is kept, every
// interpolated value (customer names, notes, anything a user typed) is
// escaped. Use it for every email body so user input can never inject markup.
export function safeHtml(
  strings: TemplateStringsArray,
  ...values: (string | number | null | undefined)[]
): string {
  return strings.reduce(
    (out, part, i) => out + part + (i < values.length ? escapeHtml(String(values[i] ?? "")) : ""),
    "",
  );
}
