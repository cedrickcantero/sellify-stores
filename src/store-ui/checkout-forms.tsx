"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { HoneypotField } from "./honeypot-field";
import { storeButtonClass } from "./form-controls";

type CheckoutAction = (previous: { message?: string }, formData: FormData) => Promise<{ message?: string }>;

// The basket's Checkout button. Disabled while the request runs so a double
// click starts one payment; shows the action's message.
export function CheckoutForm({ action }: { action: CheckoutAction }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="relative flex flex-col items-end gap-2">
      <HoneypotField />
      <button type="submit" disabled={pending} className={`${storeButtonClass} w-full sm:w-auto`}>
        {pending ? "Taking you to payment..." : "Checkout"}
      </button>
      <p role="status" className="text-sm">
        {state.message}
      </p>
    </form>
  );
}

const REFRESH_EVERY_MS = 2000;
const MAX_REFRESHES = 15;

// Payment is done but the order is not recorded yet: ask the server again
// every couple of seconds, for about half a minute.
export function OrderRefresh() {
  const router = useRouter();
  const count = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => {
      count.current += 1;
      if (count.current > MAX_REFRESHES) clearInterval(timer);
      else router.refresh();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

// Empties the basket once the order is confirmed. Runs once per page view.
export function ClearBasket({ action }: { action: () => Promise<void> }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void action();
  }, [action]);
  return null;
}
