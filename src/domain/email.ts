export const EMAIL_KINDS = [
  "repair_booked_shop",
  "repair_booked_customer",
  "buyback_accepted_shop",
  "buyback_accepted_customer",
  "order_shop",
  "order_customer",
  "order_issue_customer",
] as const;

export type EmailKind = (typeof EMAIL_KINDS)[number];

export type EmailMessage = { to: string; subject: string; html: string };

// Delivers one email. Throws when delivery fails.
export interface Mailer {
  send(msg: EmailMessage): Promise<void>;
}

const KIND_LABELS: Record<EmailKind, string> = {
  repair_booked_shop: "Repair booked (shop)",
  repair_booked_customer: "Repair booked (customer)",
  buyback_accepted_shop: "Buyback accepted (shop)",
  buyback_accepted_customer: "Buyback accepted (customer)",
  order_shop: "New order (shop)",
  order_customer: "Order confirmation",
  order_issue_customer: "Order issue",
};

export function emailKindLabel(kind: EmailKind): string {
  return KIND_LABELS[kind];
}
