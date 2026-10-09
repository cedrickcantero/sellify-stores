"use client";

import { useActionState, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { BUYBACK_QUESTIONS, type BuybackQuestionKey } from "@/domain/buyback-questions";
import { saveDeductions, type FormState } from "./actions";

export type RuleValue = { kind: "none" | "amount" | "floor"; euros: string };
export type RuleValues = Record<string, RuleValue>;

export function ruleName(key: BuybackQuestionKey, answer: boolean) {
  return `${key}-${answer ? "yes" : "no"}`;
}

const KIND_OPTIONS = [
  { value: "none", label: "No change" },
  { value: "amount", label: "Deduct amount" },
  { value: "floor", label: "Fixed offer" },
];

const IDLE: FormState = { status: "idle" };

function RuleRow({
  name,
  label,
  initial,
  error,
}: {
  name: string;
  label: string;
  initial: RuleValue;
  error?: string;
}) {
  // Controlled, so a failed save keeps what was typed.
  const [kind, setKind] = useState(initial.kind);
  const [euros, setEuros] = useState(initial.euros);
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell>
        <Field label={<span className="sr-only">Rule for {label}</span>}>
          <Select
            name={`${name}-kind`}
            aria-label={`Rule for ${label}`}
            value={kind}
            onValueChange={(value) => setKind(value as RuleValue["kind"])}
            options={KIND_OPTIONS}
          />
        </Field>
      </TableCell>
      <TableCell>
        <Field label={<span className="sr-only">Amount for {label}</span>} error={error}>
          <Input
            name={`${name}-value`}
            aria-label={`Amount for ${label}`}
            inputMode="decimal"
            placeholder="0.00"
            value={euros}
            onChange={(event) => setEuros(event.target.value)}
            disabled={kind === "none"}
          />
        </Field>
      </TableCell>
    </TableRow>
  );
}

export function DeductionForm({ initial }: { initial: RuleValues }) {
  const [state, action, pending] = useActionState(saveDeductions, IDLE);
  return (
    <Card
      title="Condition deductions"
      description="Take an amount off the base price, or set a fixed offer, for each answer. A fixed offer replaces the price, for example for a phone that will not turn on."
      footer={
        <Button type="submit" form="deductions-form" disabled={pending}>
          Save deductions
        </Button>
      }
    >
      {state.status === "saved" ? <Alert tone="success">{state.message}</Alert> : null}
      {state.status === "error" ? (
        <Alert tone="error">Fix the amounts marked below, then save again.</Alert>
      ) : null}
      <form id="deductions-form" action={action}>
        <Table caption="Condition deduction rules">
          <TableHeader>
            <TableRow>
              <TableHead>Answer</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Amount (EUR)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {BUYBACK_QUESTIONS.flatMap((question) =>
              [true, false].map((answer) => {
                const name = ruleName(question.key, answer);
                return (
                  <RuleRow
                    key={name}
                    name={name}
                    label={answer ? question.yes : question.no}
                    initial={initial[name] ?? { kind: "none", euros: "" }}
                    error={state.fieldErrors?.[name]}
                  />
                );
              }),
            )}
          </TableBody>
        </Table>
      </form>
    </Card>
  );
}
