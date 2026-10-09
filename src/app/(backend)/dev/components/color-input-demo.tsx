"use client";

import { useState } from "react";
import { ColorInput } from "@/ui";

// ColorInput is controlled, so the gallery needs a client wrapper to hold it.
export function ColorInputDemo() {
  const [value, setValue] = useState(`#${"0f766e"}`);
  return <ColorInput value={value} onChange={setValue} />;
}
