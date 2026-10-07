import type { Metadata } from "next";
import Link from "next/link";
import { signInAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in | Sellify" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Log in to Sellify</h1>
      <AuthForm
        action={signInAction}
        submitLabel="Log in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
      <p className="text-sm text-neutral-600">
        New to Sellify?{" "}
        <Link href="/signup" className="font-medium text-purple-700 underline">
          Create your shop
        </Link>
      </p>
    </main>
  );
}
