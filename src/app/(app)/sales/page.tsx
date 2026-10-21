import { Suspense } from "react";
import Link from "next/link";
import { PlusIcon, ReceiptTextIcon, SearchXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Highlight } from "@/components/search/highlight";
import { SalesFilters } from "@/components/sales/sales-filters";
import { ExportMenu } from "@/components/export-menu";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/session";
import { SALE_PAGE_SIZE, searchSales } from "@/server/queries/sales";
import { formatCalendarDate, todayISO } from "@/lib/format";
import { saleSearchSchema } from "@/lib/validation/sales";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sales" };

export default function SalesPage(props: PageProps<"/sales">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Sales searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Sales({ searchParams }: { searchParams: PageProps<"/sales">["searchParams"] }) {
  const user = await requirePageUser({ permission: "sale.view" });
  const filters = saleSearchSchema.parse(await searchParams);
  const { rows, total, page, pageCount } = await searchSales(filters);
  const filtered = Boolean(filters.q || filters.from || filters.to || filters.status !== "active");
  const terms = (filters.q ?? "").toLowerCase().split(/\s+/);

  return (
    <>
      <PageHeader
        title="Sales"
        description={`${total.toLocaleString("en-IN")} ${filtered ? "matching " : ""}sale${total === 1 ? "" : "s"}`}
        actions={
          <>
            {can(user.role, "sale.export") ? (
              <ExportMenu
                endpoint="/api/export/sales"
                params={{ q: filters.q, from: filters.from, to: filters.to, status: filters.status === "active" ? undefined : filters.status }}
              />
            ) : null}
            <Button asChild>
              <Link href="/sales/new">
                <PlusIcon /> Record sale
              </Link>
            </Button>
          </>
        }
      />
      <SalesFilters filters={filters} today={todayISO()} />
      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchXIcon}
            title="No matching sales"
            hint="Try a different invoice number, a wider date range, or “All sales”."
            action={
              <Button variant="outline" asChild>
                <Link href="/sales">Clear search and filters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ReceiptTextIcon}
            title="No sales recorded yet"
            hint="When you bill a customer, record the invoice number and products here. Stock is deducted automatically."
            action={
              <Button asChild>
                <Link href="/sales/new">
                  <PlusIcon /> Record sale
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/sales/${s.id}`} className={cn("flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5", s.status === "CANCELLED" && "opacity-70")}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <Highlight text={s.invoiceNumber} terms={terms} />
                    {s.status === "CANCELLED" ? <Badge variant="outline">Cancelled</Badge> : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    <Highlight text={s.summary + (s.itemCount > 3 ? ` +${s.itemCount - 3} more` : "")} terms={terms} />
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">{formatCalendarDate(s.date)}</p>
                  <p className="max-w-36 truncate text-sm text-muted-foreground">{s.customerName ? <Highlight text={s.customerName} terms={terms} /> : s.by}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={SALE_PAGE_SIZE}
        basePath="/sales"
        params={{ q: filters.q, from: filters.from, to: filters.to, status: filters.status === "active" ? undefined : filters.status }}
        noun="sales"
      />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton className="mb-2 h-16 max-w-sm" />
      <Skeleton className="h-11" />
      <Skeleton className="mb-4 h-16" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}
