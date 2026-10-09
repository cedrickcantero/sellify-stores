import type { Metadata } from "next";
import Link from "next/link";
import { signInAction } from "../actions";
import { AuthCard } from "../auth-card";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in | Sellify" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Log in to Sellify"
      footer={
        <>
          New to Sellify?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:text-primary-hover">
            Create your shop
          </Link>
        </>
      }
    >
      <AuthForm
        action={signInAction}
        submitLabel="Log in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthCard>
  );
}
