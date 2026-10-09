export type ImageKind = {
  contentType: "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/svg+xml";
  extension: "png" | "jpg" | "gif" | "webp" | "svg";
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

// Identifies an image from its leading bytes rather than trusting the
// browser-supplied MIME type or file name. Returns null for anything that is
// not a supported image.
export function detectImageKind(head: Uint8Array): ImageKind | null {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (startsWith(head, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(head, ascii("GIF87a")) || startsWith(head, ascii("GIF89a"))) {
    return { contentType: "image/gif", extension: "gif" };
  }
  if (startsWith(head, ascii("RIFF")) && startsWith(head, ascii("WEBP"), 8)) {
    return { contentType: "image/webp", extension: "webp" };
  }
  const text = new TextDecoder().decode(head).replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) {
    return { contentType: "image/svg+xml", extension: "svg" };
  }
  return null;
}
