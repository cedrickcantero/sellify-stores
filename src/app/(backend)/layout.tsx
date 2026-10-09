import { getActiveShop } from "@/auth/session";
import { AppShell } from "@/ui";
import { signOutAction } from "../(auth)/actions";

// Every backend page renders inside the AppShell for the active shop.
// getActiveShop() redirects to the login page without a valid session.
export default async function BackendLayout({ children }: LayoutProps<"/">) {
  const { shop } = await getActiveShop();
  return (
    <AppShell shopName={shop.name} signOutAction={signOutAction}>
      {children}
    </AppShell>
  );
}
