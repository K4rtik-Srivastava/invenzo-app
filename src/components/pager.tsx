import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildHref } from "@/lib/url";

// Previous / next page links that keep the other URL parameters (search, filters).
export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  basePath,
  params = {},
  noun = "items",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  noun?: string;
}) {
  if (total === 0) return null;
  const href = (p: number) => buildHref(basePath, { ...params, page: p > 1 ? p : undefined });
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} {noun}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={href(page - 1)} scroll={false}>
              <ChevronLeftIcon /> Previous
            </Link>
          </Button>
        ) : null}
        {page < pageCount ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={href(page + 1)} scroll={false}>
              Next <ChevronRightIcon />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function pageNumber(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
