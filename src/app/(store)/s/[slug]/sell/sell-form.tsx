"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { OfferedBrand } from "@/data";
import { BUYBACK_QUESTIONS } from "@/domain/buyback-questions";
import { storeButtonClass, storeControlClass } from "@/store-ui/form-controls";
import { ErrorSummary } from "@/store-ui/error-summary";
import { HoneypotField } from "@/store-ui/honeypot-field";
import { getOffer, type SellFormState } from "./actions";

const IDLE: SellFormState = { status: "idle" };

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm font-semibold text-(--store-text)">
      {message}
    </p>
  ) : null;
}

// React resets a form's fields after its action finishes and does not put
// controlled <select> values back, so write the chosen value in again
// whenever a response arrives.
function useKeepSelectValue(value: string, state: SellFormState) {
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = value;
    // Runs on each response, not on each change; changes already set the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return ref;
}

// Brand, model and storage from what the shop buys, then three yes/no
// condition questions. The offer itself is calculated on the server.
export function SellForm({ slug, brands }: { slug: string; brands: OfferedBrand[] }) {
  const [state, action, pending] = useActionState(getOffer, IDLE);
  const [brandName, setBrandName] = useState("");
  const [modelId, setModelId] = useState("");
  const [storage, setStorage] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const brand = brands.find((b) => b.brand === brandName);
  const model = brand?.models.find((m) => m.deviceModelId === modelId);
  const errors = state.fieldErrors ?? {};
  const brandRef = useKeepSelectValue(brandName, state);
  const modelRef = useKeepSelectValue(modelId, state);
  const storageRef = useKeepSelectValue(storage, state);
  const formRef = useRef<HTMLFormElement>(null);
  // Radios are reset the same way as selects, so check them again too.
  useEffect(() => {
    formRef.current?.querySelectorAll<HTMLInputElement>("input[type=radio]").forEach((radio) => {
      radio.checked = answers[radio.name] === radio.value;
    });
    // Runs on each response, not on each change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex max-w-xl flex-col gap-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <HoneypotField />

      <ErrorSummary message={state.message} errors={Object.values(errors)} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sell-brand" className="font-semibold">
          Brand
        </label>
        <select
          id="sell-brand"
          name="brand"
          ref={brandRef}
          className={storeControlClass}
          value={brandName}
          onChange={(e) => {
            setBrandName(e.target.value);
            setModelId("");
            setStorage("");
          }}
          required
        >
          <option value="">Choose a brand</option>
          {brands.map((b) => (
            <option key={b.brand} value={b.brand}>
              {b.brand}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sell-model" className="font-semibold">
          Model
        </label>
        <select
          id="sell-model"
          name="deviceModelId"
          ref={modelRef}
          className={storeControlClass}
          value={modelId}
          onChange={(e) => {
            setModelId(e.target.value);
            setStorage("");
          }}
          disabled={!brand}
          aria-invalid={errors.deviceModelId ? true : undefined}
          aria-describedby={errors.deviceModelId ? "sell-model-error" : undefined}
          required
        >
          <option value="">{brand ? "Choose a model" : "Choose a brand first"}</option>
          {brand?.models.map((m) => (
            <option key={m.deviceModelId} value={m.deviceModelId}>
              {m.name}
            </option>
          ))}
        </select>
        <FieldError id="sell-model-error" message={errors.deviceModelId} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sell-storage" className="font-semibold">
          Storage
        </label>
        <select
          id="sell-storage"
          name="storage"
          ref={storageRef}
          className={storeControlClass}
          value={storage}
          onChange={(e) => setStorage(e.target.value)}
          disabled={!model}
          aria-invalid={errors.storage ? true : undefined}
          aria-describedby={errors.storage ? "sell-storage-error" : undefined}
          required
        >
          <option value="">{model ? "Choose a storage size" : "Choose a model first"}</option>
          {model?.storages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <FieldError id="sell-storage-error" message={errors.storage} />
      </div>

      {BUYBACK_QUESTIONS.map((question) => (
        <fieldset
          key={question.key}
          role="radiogroup"
          aria-labelledby={`sell-${question.key}-legend`}
          aria-invalid={errors[question.key] ? true : undefined}
          className="flex flex-col gap-2"
          aria-describedby={errors[question.key] ? `sell-${question.key}-error` : undefined}
        >
          <legend id={`sell-${question.key}-legend`} className="mb-1 font-semibold">{question.label}?</legend>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map((choice) => (
              <label
                key={choice}
                className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-(--store-radius) border border-(--store-text)/60 px-3 has-[:checked]:border-2 has-[:checked]:border-(--store-primary) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--store-primary)"
              >
                <input
                  type="radio"
                  name={question.key}
                  value={choice}
                  required
                  checked={answers[question.key] === choice}
                  onChange={() => setAnswers((a) => ({ ...a, [question.key]: choice }))}
                  className="size-4 accent-(--store-primary)"
                />
                {choice === "yes" ? "Yes" : "No"}
              </label>
            ))}
          </div>
          <FieldError id={`sell-${question.key}-error`} message={errors[question.key]} />
        </fieldset>
      ))}

      <button type="submit" className={`${storeButtonClass} self-start`} disabled={pending}>
        {pending ? "Getting your offer..." : "Get my offer"}
      </button>
    </form>
  );
}
