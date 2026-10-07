import {
  Inbox,
  LayoutDashboard,
  Package,
  ReceiptText,
  Repeat,
  ShoppingCart,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// The eight backend sections, in sidebar order.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/buybacks", label: "Buybacks", icon: Repeat },
  { href: "/sales", label: "Sales", icon: ReceiptText },
  { href: "/online-store", label: "Online Store", icon: Store },
  { href: "/email-outbox", label: "Email outbox", icon: Inbox },
];
