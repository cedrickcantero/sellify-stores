import type { Metadata } from "next";
import Link from "next/link";
import { signUpAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create your shop | Sellify" };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Create your shop</h1>
      <AuthForm
        action={signUpAction}
        submitLabel="Create shop"
        fields={[
          { name: "shopName", label: "Shop name", type: "text", autoComplete: "organization" },
          { name: "name", label: "Your name", type: "text", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "new-password",
            minLength: 8,
          },
        ]}
      />
      <p className="text-sm text-neutral-600">
        Already have a shop?{" "}
        <Link href="/login" className="font-medium text-purple-700 underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
