"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { buildHref } from "@/lib/url";

type Filters = { q?: string; actor?: string; type?: string; from?: string; to?: string };

const TYPES = [
  ["product", "Products & stock"],
  ["sale", "Sales"],
  ["request", "Requests"],
  ["user", "Users"],
  ["unit", "Units"],
] as const;

export function AuditFilters({ filters, actors, today }: { filters: Filters; actors: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [q, setQ] = useState(filters.q ?? "");

  const navigate = (changes: Partial<Filters>) => startTransition(() => router.replace(buildHref(pathname, { ...filters, ...changes }), { scroll: false }));
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="mb-4 grid gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search the audit log"
          placeholder="Search, e.g. a product name or invoice number"
          value={q}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => navigate({ q: value.trim() || undefined }), 300);
          }}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-input bg-background pr-11 pl-11 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
        />
        {pending ? <Loader2Icon className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <NativeSelect aria-label="Person" value={filters.actor ?? ""} onChange={(e) => navigate({ actor: e.target.value || undefined })}>
          <option value="">Everyone</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Type" value={filters.type ?? ""} onChange={(e) => navigate({ type: e.target.value || undefined })}>
          <option value="">All changes</option>
          {TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" aria-label="From date" value={filters.from ?? ""} max={filters.to ?? today} onChange={(e) => navigate({ from: e.target.value || undefined })} />
        <Input type="date" aria-label="To date" value={filters.to ?? ""} min={filters.from} max={today} onChange={(e) => navigate({ to: e.target.value || undefined })} />
        {active ? (
          <Button
            variant="ghost"
            className="col-span-2 lg:col-span-1"
            onClick={() => {
              setQ("");
              navigate({ q: undefined, actor: undefined, type: undefined, from: undefined, to: undefined });
            }}
          >
            <XIcon /> Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
