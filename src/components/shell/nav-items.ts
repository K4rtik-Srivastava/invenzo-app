import { HomeIcon, PackageIcon, ReceiptTextIcon, InboxIcon, UsersIcon, ScrollTextIcon, type LucideIcon } from "lucide-react";
import { can, type Permission, type Role } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission?: Permission; mobile: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: HomeIcon, mobile: true },
  { href: "/inventory", label: "Inventory", icon: PackageIcon, mobile: true },
  { href: "/sales", label: "Sales", icon: ReceiptTextIcon, mobile: true },
  { href: "/requests", label: "Requests", icon: InboxIcon, mobile: true },
  { href: "/users", label: "Users", icon: UsersIcon, permission: "user.manage", mobile: false },
  { href: "/audit", label: "Audit log", icon: ScrollTextIcon, permission: "audit.view", mobile: false },
];

export function navItemsFor(role: Role) {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
