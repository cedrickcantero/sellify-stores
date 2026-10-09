"use client";

import { useState } from "react";
import { WEEKDAYS, type StoreConfig, type Weekday } from "@/domain/store-config";
import { Card, Field, Input, Switch } from "@/ui";
import type { EditorSection } from "./editor-types";

const DAY_NAMES: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const FALLBACK = { open: "09:00", close: "18:00" };

type DayState = { closed: boolean; open: string; close: string };

function initialDay(day: StoreConfig["openingHours"][Weekday]): DayState {
  return day ? { closed: false, ...day } : { closed: true, ...FALLBACK };
}

// One row per weekday: a Closed switch and open and close times. Each day
// autosaves on its own; a closing time that is not after the opening time
// comes back from the server as a field error on that day.
export function OpeningHoursCard({ draft, errors, queue }: EditorSection) {
  const [days, setDays] = useState<Record<Weekday, DayState>>(
    () => Object.fromEntries(WEEKDAYS.map((day) => [day, initialDay(draft.openingHours[day])])) as Record<Weekday, DayState>,
  );

  function update(day: Weekday, next: DayState) {
    setDays((all) => ({ ...all, [day]: next }));
    queue(`hours-${day}`, {
      openingHours: { [day]: next.closed ? null : { open: next.open, close: next.close } },
    });
  }

  return (
    <Card title="Opening hours" description="Shown on your store. Repair bookings are offered only inside these hours.">
      <ul className="flex flex-col divide-y divide-border">
        {WEEKDAYS.map((day) => {
          const state = days[day];
          const timeError = errors[`openingHours.${day}.close`] ?? errors[`openingHours.${day}.open`];
          return (
            <li key={day} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-6">
              <div className="sm:w-44 sm:pt-2">
                <Switch
                  label={DAY_NAMES[day]}
                  description={state.closed ? "Closed" : "Open"}
                  checked={!state.closed}
                  onCheckedChange={(open) => update(day, { ...state, closed: !open })}
                />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3">
                <Field label={`${DAY_NAMES[day]} opens`} error={timeError ? undefined : errors[`openingHours.${day}.open`]}>
                  <Input
                    type="time"
                    value={state.open}
                    disabled={state.closed}
                    onChange={(event) => update(day, { ...state, open: event.target.value })}
                  />
                </Field>
                <Field label={`${DAY_NAMES[day]} closes`} error={errors[`openingHours.${day}.close`]}>
                  <Input
                    type="time"
                    value={state.close}
                    disabled={state.closed}
                    onChange={(event) => update(day, { ...state, close: event.target.value })}
                  />
                </Field>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
