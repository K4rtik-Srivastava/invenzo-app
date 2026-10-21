"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/permissions";
import { isActive, navItemsFor } from "@/components/shell/nav-items";

// Phone navigation: the four main sections as big thumb-friendly tabs.
export function BottomNav({ role, pendingRequests }: { role: Role; pendingRequests: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {navItemsFor(role)
        .filter((item) => item.mobile)
        .map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon className="size-6" />
              {label}
              {href === "/requests" && pendingRequests > 0 ? (
                <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-primary px-1.5 text-[0.7rem] font-semibold text-primary-foreground">
                  {pendingRequests}
                </span>
              ) : null}
            </Link>
          );
        })}
    </nav>
  );
}
