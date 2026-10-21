"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/permissions";
import { isActive, navItemsFor } from "@/components/shell/nav-items";

export function SidebarNav({ role, pendingRequests }: { role: Role; pendingRequests: number }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1" aria-label="Main">
      {navItemsFor(role).map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-5" />
            <span className="flex-1">{label}</span>
            {href === "/requests" && pendingRequests > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{pendingRequests}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
