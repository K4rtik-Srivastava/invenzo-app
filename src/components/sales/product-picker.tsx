"use client";

import { useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { StockBadge } from "@/components/products/stock-badge";
import { Highlight } from "@/components/search/highlight";
import type { QuickSearchResult } from "@/server/queries/products";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PickedProduct = { id: string; name: string; unit: string; available: string };

// "Add a product" box on the sale form: type a few letters, pick a product.
export function ProductPicker({
  excludeIds,
  onSelect,
  inputRef,
}: {
  excludeIds: string[];
  onSelect: (product: PickedProduct) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const listId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<QuickSearchResult["rows"]>([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const options = rows.filter((r) => !excludeIds.includes(r.id));

  function onChange(value: string) {
    setQ(value);
    setOpen(true);
    setActive(0);
    clearTimeout(timer.current);
    request.current?.abort();
    if (!value.trim()) {
      setRows([]);
      setSearched("");
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal });
        const data = (await response.json()) as QuickSearchResult;
        setRows(data.rows ?? []);
        setSearched(value.trim());
      } catch {
        // aborted or offline: keep the previous results
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
  }

  function choose(row: QuickSearchResult["rows"][number]) {
    onSelect({ id: row.id, name: row.name, unit: row.unit, available: row.currentStock });
    onChange("");
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <PlusIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open && q.trim().length > 0}
        aria-controls={listId}
        aria-label="Add a product"
        placeholder="Add a product: type name, SKU or HSN…"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        className="h-12 w-full rounded-xl border border-dashed border-input bg-background pr-10 pl-11 text-base outline-none focus:border-solid focus:border-ring focus:ring-3 focus:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {loading ? <Loader2Icon className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
      {open && q.trim() ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-xl border bg-popover py-1 shadow-lg">
          {options.map((row, index) => {
            const out = Number(row.currentStock) <= 0;
            return (
              <li key={row.id} role="option" aria-selected={active === index} aria-disabled={out}>
                <button
                  type="button"
                  disabled={out}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(row)}
                  className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left disabled:opacity-50", active === index && "bg-muted")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <Highlight text={row.name} terms={q.trim().toLowerCase().split(/\s+/)} />
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{[row.brand, row.sku].filter(Boolean).join(" · ") || " "}</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold tabular">{formatQty(row.currentStock, row.unit)}</span>
                    {row.status !== "in" ? <StockBadge status={row.status} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
          {!loading && searched === q.trim() && options.length === 0 ? (
            <li className="px-4 py-4 text-center text-muted-foreground">
              {rows.length > 0 ? "Those products are already on this sale." : `No products match “${q.trim()}”.`}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
