import Image from "next/image";
import type { ReactNode } from "react";
import { Card } from "@/ui";

// Centred card with the Sellify logo for the sign-up and login pages.
export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-100 flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center justify-center gap-2">
        <Image src="/brand/sellify-logo.png" alt="" width={36} height={28} priority />
        <span className="font-heading text-page-title text-foreground">Sellify</span>
      </div>
      <Card>
        <h1 className="font-heading text-page-title text-foreground">{title}</h1>
        {children}
      </Card>
      <p className="text-center text-body text-muted-foreground">{footer}</p>
    </main>
  );
}
