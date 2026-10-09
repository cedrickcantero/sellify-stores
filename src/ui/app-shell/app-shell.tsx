import type { ReactNode } from "react";
import { Button } from "../button";
import { Logo, MobileNav, SidebarNav } from "./nav";

/**
 * The backend layout: a 240px sidebar with the eight sections, a header with
 * the shop name and Log out, and page content centred at up to 1200px.
 * Rendered once by the (backend) layout; pages render only their content,
 * starting with a PageHeader.
 */
export function AppShell({
  shopName,
  signOutAction,
  children,
}: {
  shopName: string;
  /** Server action that ends the session. */
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full">
      {/* The aside stretches the full page height (background and border);
          its content sticks to the top while the page scrolls. */}
      <aside className="hidden w-sidebar shrink-0 border-r border-border bg-surface lg:block">
        <div className="sticky top-0 flex max-h-dvh flex-col gap-6 overflow-y-auto px-4 py-5">
          <div className="px-2">
            <Logo />
          </div>
          <SidebarNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
          <MobileNav />
          <p className="min-w-0 flex-1 truncate font-heading text-body font-semibold text-foreground">
            {shopName}
          </p>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </header>
        <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
