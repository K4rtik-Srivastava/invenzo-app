"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { SORT_LABELS, PRODUCT_SORTS, type ProductSearch } from "@/lib/validation/search";

type Filters = Pick<ProductSearch, "q" | "brand" | "unit" | "stock" | "sort" | "archived">;

const DEBOUNCE_MS = 300;

// Search box + filters for the Inventory page. They live in the address bar
// (?q=…&brand=…), so a filtered list can be bookmarked or shared, and the
// server does the searching and paging.
export function InventoryFilters({
  filters,
  brands,
  units,
}: {
  filters: Filters;
  brands: string[];
  units: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [q, setQ] = useState(filters.q ?? "");
  const [focused, setFocused] = useState(false);
  const [syncedQ, setSyncedQ] = useState(filters.q);

  // If the search changes from elsewhere (e.g. the top search bar's "See all"),
  // show it here too, unless the person is typing in this box right now.
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    if (!focused) setQ(filters.q ?? "");
  }

  function navigate(changes: Partial<Record<keyof Filters, string | undefined>>) {
    const next = { ...filters, ...changes };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === "sort" && value === "name")) params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onSearch(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate({ q: value.trim() || undefined }), DEBOUNCE_MS);
  }

  const activeCount = [filters.q, filters.brand, filters.unit, filters.stock].filter(Boolean).length;

  return (
    <div className="mb-4 grid gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search inventory"
          placeholder="Search name, brand, HSN, SKU or description"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              clearTimeout(timer.current);
              navigate({ q: q.trim() || undefined });
            }
          }}
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

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <NativeSelect aria-label="Brand" value={filters.brand ?? ""} onChange={(e) => navigate({ brand: e.target.value || undefined })}>
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Unit" value={filters.unit ?? ""} onChange={(e) => navigate({ unit: e.target.value || undefined })}>
          <option value="">All units</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Stock status" value={filters.stock ?? ""} onChange={(e) => navigate({ stock: e.target.value || undefined })}>
          <option value="">Any stock level</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </NativeSelect>
        <NativeSelect aria-label="Sort by" value={filters.sort} onChange={(e) => navigate({ sort: e.target.value })}>
          {PRODUCT_SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {activeCount > 0 ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              navigate({ q: undefined, brand: undefined, unit: undefined, stock: undefined });
            }}
          >
            <XIcon /> Clear {activeCount === 1 ? "filter" : `${activeCount} filters`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
