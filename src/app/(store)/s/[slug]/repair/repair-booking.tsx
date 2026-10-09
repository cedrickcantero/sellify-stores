"use client";

import { useActionState, useState, useTransition } from "react";
import type { OfferedRepairBrand } from "@/data";
import { formatCents } from "@/domain/product";
import { formatClock, formatDayLabel } from "@/domain/repair-slots";
import { HoneypotField } from "@/store-ui";
import { bookRepairAction, loadSlotsAction, type BookingState } from "./actions";

const IDLE: BookingState = { status: "idle" };

const choice =
  "min-h-11 rounded-(--store-radius) border border-(--store-text)/25 px-4 py-2 text-left hover:border-(--store-primary) aria-pressed:border-(--store-primary) aria-pressed:bg-(--store-primary) aria-pressed:text-(--store-on-primary)";
const input =
  "min-h-11 w-full rounded-(--store-radius) border border-(--store-text)/40 bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--store-primary)";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-(--store-radius) bg-(--store-primary) px-6 py-2 font-semibold text-(--store-on-primary) disabled:opacity-50";

type Props = {
  slug: string;
  brands: OfferedRepairBrand[];
  timezone: string;
  firstDate: string;
  lastDate: string;
};

export function RepairBooking({ slug, brands, timezone, firstDate, lastDate }: Props) {
  const [brandName, setBrandName] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [repairId, setRepairId] = useState<string | null>(null);
  const [date, setDate] = useState(firstDate);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: BookingState, form: FormData) => {
    const next = await bookRepairAction(slug, prev, form);
    // A clash or a slot that has passed: ask for another slot and refresh the list.
    if (next.status === "error" && next.slotTaken) {
      setSlotStart(null);
      setSlots(await loadSlotsAction(slug, String(form.get("repairPriceId") ?? ""), date));
    }
    return next;
  }, IDLE);

  const brand = brands.find((b) => b.brand === brandName);
  const model = brand?.models.find((m) => m.deviceModelId === modelId);
  const repair = model?.repairs.find((r) => r.repairPriceId === repairId);

  function refreshSlots(repairPriceId: string, day: string) {
    setSlots(null);
    startTransition(async () => {
      setSlots(await loadSlotsAction(slug, repairPriceId, day));
    });
  }

  function pickRepair(id: string) {
    setRepairId(id);
    setSlotStart(null);
    refreshSlots(id, date);
  }

  function pickDate(day: string) {
    setDate(day);
    setSlotStart(null);
    if (repairId && day >= firstDate && day <= lastDate) refreshSlots(repairId, day);
  }

  if (state.status === "booked") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-(--store-radius) border border-(--store-primary) p-6">
        <h2 className="font-(family-name:--store-font-heading) text-2xl font-bold">You are booked in</h2>
        <p>
          {state.slotStart
            ? `${formatDayLabel(state.slotStart, timezone)} at ${formatClock(state.slotStart, timezone)}. `
            : ""}
          We have emailed you a confirmation.
        </p>
      </div>
    );
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? state.values : undefined;
  const sameDay = repair !== undefined && repair.partQty > 0;

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-(family-name:--store-font-heading) text-xl font-bold">1. Brand</legend>
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <button
              key={b.brand}
              type="button"
              className={choice}
              aria-pressed={b.brand === brandName}
              onClick={() => {
                setBrandName(b.brand);
                setModelId(null);
                setRepairId(null);
                setSlots(null);
                setSlotStart(null);
              }}
            >
              {b.brand}
            </button>
          ))}
        </div>
      </fieldset>

      {brand ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-(family-name:--store-font-heading) text-xl font-bold">2. Model</legend>
          <div className="flex flex-wrap gap-2">
            {brand.models.map((m) => (
              <button
                key={m.deviceModelId}
                type="button"
                className={choice}
                aria-pressed={m.deviceModelId === modelId}
                onClick={() => {
                  setModelId(m.deviceModelId);
                  setRepairId(null);
                  setSlots(null);
                  setSlotStart(null);
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {model ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-(family-name:--store-font-heading) text-xl font-bold">3. Repair</legend>
          <div className="flex flex-wrap gap-2">
            {model.repairs.map((r) => (
              <button
                key={r.repairPriceId}
                type="button"
                className={choice}
                aria-pressed={r.repairPriceId === repairId}
                onClick={() => pickRepair(r.repairPriceId)}
              >
                {r.repairType}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {repair ? (
        <>
          <p className="flex flex-wrap items-center gap-3" aria-live="polite">
            <span className="font-(family-name:--store-font-heading) text-2xl font-bold">{formatCents(repair.price)}</span>
            {sameDay ? (
              <span className="rounded-(--store-radius) border border-(--store-primary) px-3 py-1 text-sm font-semibold">
                Same-day repair available
              </span>
            ) : null}
          </p>

          <div className="flex flex-col gap-3">
            <label htmlFor="repair-date" className="font-(family-name:--store-font-heading) text-xl font-bold">
              4. Pick a day and time
            </label>
            <input
              id="repair-date"
              type="date"
              className={`${input} max-w-xs`}
              value={date}
              min={firstDate}
              max={lastDate}
              onChange={(e) => pickDate(e.target.value)}
            />
            <div aria-live="polite" className="flex flex-wrap gap-2">
              {slots === null ? (
                <p className="text-(--store-text)/75">Loading times...</p>
              ) : slots.length === 0 ? (
                <p className="text-(--store-text)/75">No times free on this day. Pick another day.</p>
              ) : (
                slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={choice}
                    aria-pressed={s === slotStart}
                    onClick={() => setSlotStart(s)}
                  >
                    {formatClock(s, timezone)}
                  </button>
                ))
              )}
            </div>
          </div>

          {slotStart ? (
            <form action={formAction} className="relative flex max-w-md flex-col gap-4" noValidate>
              <h2 className="font-(family-name:--store-font-heading) text-xl font-bold">5. Your details</h2>
              <input type="hidden" name="repairPriceId" value={repair.repairPriceId} />
              <input type="hidden" name="slotStart" value={slotStart} />
              <HoneypotField />
              {state.status === "error" ? (
                <p role="alert" className="font-semibold">
                  {state.message}
                </p>
              ) : null}
              <Field name="name" label="Name" autoComplete="name" error={errors.name} defaultValue={values?.name} />
              <Field
                name="phone"
                label="Phone"
                type="tel"
                autoComplete="tel"
                error={errors.phone}
                defaultValue={values?.phone}
              />
              <Field
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                error={errors.email}
                defaultValue={values?.email}
              />
              <button type="submit" className={primaryButton} disabled={pending}>
                {pending ? "Booking..." : "Book repair"}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  defaultValue?: string;
}) {
  const id = `repair-${props.name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {props.label}
      </label>
      <input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue}
        required
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${id}-error` : undefined}
        className={input}
      />
      {props.error ? (
        <p id={`${id}-error`} className="text-sm font-semibold">
          {props.error}
        </p>
      ) : null}
    </div>
  );
}
