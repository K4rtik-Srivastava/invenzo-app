"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { SaleSearch } from "@/lib/validation/sales";
import { buildHref } from "@/lib/url";

type Filters = Pick<SaleSearch, "q" | "from" | "to" | "status">;

export function SalesFilters({ filters, today }: { filters: Filters; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [q, setQ] = useState(filters.q ?? "");

  function navigate(changes: Partial<Filters>) {
    const next = { ...filters, ...changes };
    startTransition(() =>
      router.replace(buildHref(pathname, { ...next, status: next.status === "active" ? undefined : next.status }), { scroll: false }),
    );
  }

  function onSearch(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate({ q: value.trim() || undefined }), 300);
  }

  const active = Boolean(filters.q || filters.from || filters.to || filters.status !== "active");

  return (
    <div className="mb-4 grid gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search sales"
          placeholder="Search invoice number, customer or product"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 w-full rounded-xl border border-input bg-background pr-11 pl-11 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2">
          {pending ? (
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          ) : q ? (
            <button type="button" aria-label="Clear search" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => onSearch("")}>
              <XIcon className="size-4" />
            </button>
          ) : null}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="grid gap-1 text-sm text-muted-foreground">
          From
          <Input type="date" value={filters.from ?? ""} max={filters.to ?? today} onChange={(e) => navigate({ from: e.target.value || undefined })} />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          To
          <Input type="date" value={filters.to ?? ""} min={filters.from} max={today} onChange={(e) => navigate({ to: e.target.value || undefined })} />
        </label>
        <label className="col-span-2 grid gap-1 text-sm text-muted-foreground lg:col-span-1">
          Status
          <NativeSelect value={filters.status} onChange={(e) => navigate({ status: e.target.value as Filters["status"] })}>
            <option value="active">Active sales</option>
            <option value="cancelled">Cancelled sales</option>
            <option value="all">All sales</option>
          </NativeSelect>
        </label>
        {active ? (
          <Button
            variant="ghost"
            className="col-span-2 self-end lg:col-span-1"
            onClick={() => {
              setQ("");
              navigate({ q: undefined, from: undefined, to: undefined, status: "active" });
            }}
          >
            <XIcon /> Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
