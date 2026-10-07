// Runs in every unit worker but only acts in component tests, which run in
// jsdom: adds the jest-dom matchers, unmounts after each test and fills in
// browser APIs that Radix primitives use but jsdom lacks.
import { afterEach } from "vitest";

if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");

  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  const proto = window.HTMLElement.prototype;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
