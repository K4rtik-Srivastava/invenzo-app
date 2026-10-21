"use client";

import Link from "next/link";
import { ChevronsUpDownIcon, KeyRoundIcon, LogOutIcon, ScrollTextIcon, UsersIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { can, ROLE_LABEL, type Role } from "@/lib/permissions";
import { signOutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

function initials(name: string) {
  // First letter of the first two words, ignoring brackets, digits and symbols.
  const words = name.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

export function UserMenu({ name, email, role, compact = false }: { name: string; email: string; role: Role; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-lg text-left outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "p-1" : "w-full p-2",
        )}
        aria-label="Account menu"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials(name)}
        </span>
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{name}</span>
              <span className="block truncate text-sm text-muted-foreground">{ROLE_LABEL[role]}</span>
            </span>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {can(role, "user.manage") ? (
          <DropdownMenuItem asChild className="md:hidden">
            <Link href="/users">
              <UsersIcon /> Users
            </Link>
          </DropdownMenuItem>
        ) : null}
        {can(role, "audit.view") ? (
          <DropdownMenuItem asChild className="md:hidden">
            <Link href="/audit">
              <ScrollTextIcon /> Audit log
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/account">
            <KeyRoundIcon /> Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOutIcon /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
