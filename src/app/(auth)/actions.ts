"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth/server";
import { clientIp, rateLimit } from "@/services/abuse";
import { registerShopOwner } from "@/services/register-shop-owner";

// `values` echoes back the non-secret fields so the form keeps them after an
// error (React resets a form once its action finishes).
export type AuthFormState = { error?: string; values?: Record<string, string> };

const TOO_MANY = "Too many attempts. Wait a minute, then try again.";

// Each attempt is charged to every bucket in its list and goes ahead only if
// all of them still had a token.
// - login: a strict bucket per email and IP stops guessing one account's
//   password from one place; a loose bucket per email caps a spread-out
//   attack without letting strangers lock the owner out; a bucket per IP
//   stops one caller trying many accounts.
// - signup: per IP and per email.
type Limit = { scope: "ip" | "email" | "email-ip"; capacity: number; refillPerMinute: number };
const LIMITS: Record<"login" | "signup", Limit[]> = {
  login: [
    { scope: "email-ip", capacity: 5, refillPerMinute: 2 },
    { scope: "email", capacity: 30, refillPerMinute: 10 },
    { scope: "ip", capacity: 20, refillPerMinute: 10 },
  ],
  signup: [
    { scope: "ip", capacity: 5, refillPerMinute: 1 },
    { scope: "email", capacity: 3, refillPerMinute: 1 },
  ],
};

async function withinLimits(action: keyof typeof LIMITS, rawEmail: string): Promise<boolean> {
  const ip = clientIp(await headers());
  const email = rawEmail.trim().toLowerCase().slice(0, 254);
  const keys = { ip, email, "email-ip": `${email}|${ip}` };
  const results = await Promise.all(
    LIMITS[action].map((limit) => rateLimit(`${action}:${limit.scope}:${keys[limit.scope]}`, limit)),
  );
  return results.every(Boolean);
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = {
    name: text(form, "name"),
    email: text(form, "email"),
    shopName: text(form, "shopName"),
  };
  if (!(await withinLimits("signup", values.email))) return { values, error: TOO_MANY };
  const result = await registerShopOwner({ ...values, password: text(form, "password") });
  if (!result.ok) {
    const messages = {
      email_taken: "That email already has an account. Log in instead.",
      invalid: "Check your details. Passwords need at least 8 characters.",
      signup_failed: "We could not create your shop. Try again.",
    } as const;
    return { values, error: messages[result.error] };
  }
  redirect("/dashboard");
}

const signInInput = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(1).max(128),
});

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: text(form, "email") };
  const parsed = signInInput.safeParse({ ...values, password: text(form, "password") });
  if (!parsed.success) return { values, error: "Enter your email and password." };
  if (!(await withinLimits("login", parsed.data.email))) return { values, error: TOO_MANY };

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) return { values, error: "Wrong email or password." };
    throw error;
  }
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
