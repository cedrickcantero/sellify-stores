// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultStoreConfig } from "@/domain/store-config";
import { OpeningHoursCard } from "./opening-hours-card";

describe("OpeningHoursCard errors", () => {
  it("shows an invalid opening time on its own, without a closing-time error", () => {
    render(
      <OpeningHoursCard
        draft={defaultStoreConfig("FixIt")}
        errors={{ "openingHours.mon.open": "Enter a time like 09:00." }}
        queue={vi.fn()}
      />,
    );
    expect(screen.getByText("Enter a time like 09:00.")).toBeInTheDocument();
    expect(screen.getByLabelText("Monday opens")).toBeInvalid();
  });
});
