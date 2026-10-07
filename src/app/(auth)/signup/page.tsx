import type { Metadata } from "next";
import Link from "next/link";
import { signUpAction } from "../actions";
import { AuthCard } from "../auth-card";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create your shop | Sellify" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your shop"
      footer={
        <>
          Already have a shop?{" "}
          <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
            Log in
          </Link>
        </>
      }
    >
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
    </AuthCard>
  );
}
