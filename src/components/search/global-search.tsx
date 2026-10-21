"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { StockBadge } from "@/components/products/stock-badge";
import { Highlight } from "@/components/search/highlight";
import type { QuickSearchResult } from "@/server/queries/products";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

type Results = QuickSearchResult & { query: string };

const DEBOUNCE_MS = 250;

// The search bar at the top of every page. Searches name, brand, HSN code,
// SKU and description on the server as you type, best matches first.
export function GlobalSearch({ autoFocus = false, shortcut = false, onNavigate }: { autoFocus?: boolean; shortcut?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [results, setResults] = useState<Results | null>(null);

  // Press "/" anywhere to jump to the search bar.
  useEffect(() => {
    if (!shortcut) return;
    function onKey(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  async function load(query: string, page: number) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&page=${page}`, { signal: controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as QuickSearchResult;
      setResults((previous) =>
        page > 1 && previous?.query === query ? { ...data, query, rows: [...previous.rows, ...data.rows] } : { ...data, query },
      );
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function onChange(value: string) {
    setQ(value);
    setOpen(true);
    setActive(-1);
    clearTimeout(timer.current);
    if (!value.trim()) {
      request.current?.abort();
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => void load(value.trim(), 1), DEBOUNCE_MS);
  }

  function reset() {
    onChange("");
    setOpen(false);
    onNavigate?.();
  }

  function go(href: string) {
    router.push(href);
    reset();
    inputRef.current?.blur();
  }

  const rows = results?.query === q.trim() ? results.rows : (results?.rows ?? []);
  const seeAllHref = `/inventory?q=${encodeURIComponent(q.trim())}`;
  const optionCount = rows.length + (q.trim() ? 1 : 0); // + "see all results"
  const terms = q.trim().toLowerCase().split(/\s+/);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, optionCount - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter" && q.trim()) {
      event.preventDefault();
      if (active >= 0 && active < rows.length) go(`/inventory/${rows[active].id}`);
      else go(seeAllHref);
    } else if (event.key === "Escape") {
      if (q) onChange("");
      else inputRef.current?.blur();
      setOpen(false);
    }
  }

  const showPanel = open && q.trim().length > 0;

  return (
    <div
      className="relative w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Search products"
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        placeholder="Search products by name, brand, HSN, SKU…"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-xl border border-input bg-muted/40 pr-20 pl-11 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:ring-3 focus:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
        {loading ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : null}
        {q ? (
          <button type="button" onClick={() => onChange("")} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search">
            <XIcon className="size-4" />
          </button>
        ) : shortcut ? (
          <kbd className="hidden rounded border bg-background px-1.5 text-xs text-muted-foreground lg:inline">/</kbd>
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover shadow-lg">
          <ul id={listId} role="listbox" aria-label="Matching products" className="max-h-[60vh] overflow-y-auto py-1">
            {rows.map((p, index) => (
              <li key={p.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}>
                <Link
                  href={`/inventory/${p.id}`}
                  onClick={reset}
                  onMouseEnter={() => setActive(index)}
                  className={cn("flex items-center gap-3 px-4 py-2.5", active === index && "bg-muted")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      <Highlight text={p.name} terms={terms} />
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[p.brand, p.sku, p.hsnCode ? `HSN ${p.hsnCode}` : null].filter(Boolean).map((part, i) => (
                        <span key={i}>
                          {i > 0 ? " · " : null}
                          <Highlight text={part!} terms={terms} />
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold tabular">{formatQty(p.currentStock, p.unit)}</span>
                    {p.status !== "in" ? <StockBadge status={p.status} /> : null}
                  </div>
                </Link>
              </li>
            ))}
            {results && results.query === q.trim() && rows.length === 0 && !loading ? (
              <li className="px-4 py-6 text-center text-muted-foreground">No products match “{q.trim()}”.</li>
            ) : null}
            {error ? <li className="px-4 py-3 text-sm text-destructive">Search isn’t working right now. Please try again.</li> : null}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-2 py-1.5">
            {results && results.page < results.pageCount && results.query === q.trim() ? (
              <button
                type="button"
                className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => void load(q.trim(), results.page + 1)}
              >
                Show more
              </button>
            ) : (
              <span />
            )}
            <Link
              id={`${listId}-${rows.length}`}
              href={seeAllHref}
              onClick={reset}
              onMouseEnter={() => setActive(rows.length)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-muted",
                active === rows.length && "bg-muted",
              )}
            >
              {results && results.query === q.trim() ? `See all ${results.total.toLocaleString("en-IN")} results` : "See all results"}
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
