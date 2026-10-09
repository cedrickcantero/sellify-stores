"use client";

import { useState } from "react";
import { FONT_PAIRS, SLOT_MINUTES } from "@/domain/store-config";
import { Card, ColorInput, Field, Input, Select, Switch, Textarea } from "@/ui";
import type { EditorSection } from "./editor-types";

const FONT_LABELS: Record<(typeof FONT_PAIRS)[number], string> = {
  modern: "Modern (clean sans-serif)",
  slab: "Slab (sturdy headings)",
  serif: "Serif (classic)",
};

const COLOR_FIELDS = [
  { key: "primary", label: "Primary colour", hint: "Buttons and links." },
  { key: "accent", label: "Accent colour", hint: "Banner and highlights." },
  { key: "background", label: "Background colour", hint: "Page background." },
  { key: "text", label: "Text colour", hint: "Body text." },
] as const;

// A number box that sends nothing usable while empty, so the server answers
// with the field's own error instead of saving a zero.
function numberOrNull(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw);
}

export function BrandCard({ draft, errors, queue }: EditorSection) {
  const [colors, setColors] = useState(draft.brand.colors);
  const [fontPair, setFontPair] = useState<string>(draft.brand.fontPair);
  const [radius, setRadius] = useState(String(draft.brand.radius));

  return (
    <Card title="Brand" description="Colours, fonts and corner shape for your store.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {COLOR_FIELDS.map(({ key, label, hint }) => (
          <Field key={key} label={label} hint={hint} error={errors[`brand.colors.${key}`]}>
            <ColorInput
              label={label}
              value={colors[key]}
              onChange={(value) => {
                setColors((all) => ({ ...all, [key]: value }));
                queue("brand-colors", { brand: { colors: { [key]: value } } });
              }}
            />
          </Field>
        ))}
        <Field label="Font pair" error={errors["brand.fontPair"]}>
          <Select
            value={fontPair}
            options={FONT_PAIRS.map((value) => ({ value, label: FONT_LABELS[value] }))}
            onValueChange={(value) => {
              setFontPair(value);
              queue("brand-font", { brand: { fontPair: value } });
            }}
          />
        </Field>
        <Field label="Corner radius" hint="0 is square, 24 is very round." error={errors["brand.radius"]}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            value={radius}
            onChange={(event) => {
              setRadius(event.target.value);
              queue("brand-radius", { brand: { radius: numberOrNull(event.target.value) } });
            }}
          />
        </Field>
      </div>
    </Card>
  );
}

export function BannerCard({ draft, errors, queue }: EditorSection) {
  const [enabled, setEnabled] = useState(draft.content.banner.enabled);
  const [text, setText] = useState(draft.content.banner.text);

  return (
    <Card title="Banner" description="A short announcement across the top of every store page.">
      <Switch
        label="Show banner"
        checked={enabled}
        onCheckedChange={(next) => {
          setEnabled(next);
          queue("banner", { content: { banner: { enabled: next } } });
        }}
      />
      <Field label="Banner text" hint="Up to 160 characters." error={errors["content.banner.text"]}>
        <Input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            queue("banner", { content: { banner: { text: event.target.value } } });
          }}
        />
      </Field>
    </Card>
  );
}

export function AboutCard({ draft, errors, queue }: EditorSection) {
  const [about, setAbout] = useState(draft.content.about);

  return (
    <Card title="About" description="Tell customers who you are. Shown on your store home page.">
      <Field label="About text" hint="Up to 2000 characters." error={errors["content.about"]}>
        <Textarea
          rows={5}
          value={about}
          onChange={(event) => {
            setAbout(event.target.value);
            queue("about", { content: { about: event.target.value } });
          }}
        />
      </Field>
    </Card>
  );
}

export function ContactCard({ draft, errors, queue }: EditorSection) {
  const [contact, setContact] = useState(draft.contact);

  function change(key: "phone" | "email" | "address", value: string) {
    setContact((all) => ({ ...all, [key]: value }));
    queue("contact", { contact: { [key]: value } });
  }

  return (
    <Card title="Contact" description="How customers can reach you.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Phone" error={errors["contact.phone"]}>
          <Input type="tel" autoComplete="off" value={contact.phone} onChange={(e) => change("phone", e.target.value)} />
        </Field>
        <Field label="Email" error={errors["contact.email"]}>
          <Input type="email" autoComplete="off" value={contact.email} onChange={(e) => change("email", e.target.value)} />
        </Field>
        <Field label="Address" error={errors["contact.address"]} className="md:col-span-2">
          <Input value={contact.address} onChange={(e) => change("address", e.target.value)} />
        </Field>
      </div>
    </Card>
  );
}

export function RepairCard({ draft, errors, queue }: EditorSection) {
  const [slotMinutes, setSlotMinutes] = useState(String(draft.repair.slotMinutes));
  const [capacity, setCapacity] = useState(String(draft.repair.slotCapacity));

  return (
    <Card title="Repair bookings" description="How customers book a repair time.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Slot length" error={errors["repair.slotMinutes"]}>
          <Select
            value={slotMinutes}
            options={SLOT_MINUTES.map((minutes) => ({ value: String(minutes), label: `${minutes} minutes` }))}
            onValueChange={(value) => {
              setSlotMinutes(value);
              queue("repair-slot", { repair: { slotMinutes: Number(value) } });
            }}
          />
        </Field>
        <Field label="Bookings per slot" hint="How many repairs you can start at once." error={errors["repair.slotCapacity"]}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={capacity}
            onChange={(event) => {
              setCapacity(event.target.value);
              queue("repair-capacity", { repair: { slotCapacity: numberOrNull(event.target.value) } });
            }}
          />
        </Field>
      </div>
    </Card>
  );
}

const TAB_SWITCHES = [
  { key: "shop", label: "Shop", description: "Phones and accessories in stock." },
  { key: "repair", label: "Repair", description: "Repair prices and bookings." },
  { key: "sell", label: "Sell", description: "Customers ask for an offer on their phone." },
] as const;

export function TabsCard({ draft, queue }: EditorSection) {
  const [tabs, setTabs] = useState(draft.tabs);

  return (
    <Card title="Tabs" description="Choose which sections customers see in your store.">
      <div className="flex max-w-md flex-col gap-4">
        {TAB_SWITCHES.map(({ key, label, description }) => (
          <Switch
            key={key}
            label={label}
            description={description}
            checked={tabs[key]}
            onCheckedChange={(next) => {
              setTabs((all) => ({ ...all, [key]: next }));
              queue(`tabs-${key}`, { tabs: { [key]: next } });
            }}
          />
        ))}
      </div>
    </Card>
  );
}
