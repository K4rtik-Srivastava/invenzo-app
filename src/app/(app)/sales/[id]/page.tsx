import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BanIcon, ChevronLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FlashToast } from "@/components/flash-toast";
import { SaleActions } from "@/components/sales/sale-actions";
import { SaleRequestButton } from "@/components/requests/request-buttons";
import { PendingRequestsNotice } from "@/components/requests/pending-notice";
import { requirePageUser } from "@/server/session";
import { getSale } from "@/server/queries/sales";
import { pendingRequestsFor } from "@/server/queries/requests";
import { can } from "@/lib/permissions";
import { formatCalendarDate, formatDateTime, formatQty } from "@/lib/format";

type Props = PageProps<"/sales/[id]">;

export default function SalePage(props: Props) {
  return (
    <>
      <Link href="/sales" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Sales
      </Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Sale params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Sale({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const user = await requirePageUser({ permission: "sale.view" });
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [sale, pending] = await Promise.all([getSale(id), pendingRequestsFor({ saleId: id })]);
  if (!sale) notFound();
  const active = sale.status === "ACTIVE";

  return (
    <>
      {query.created ? <FlashToast message={`Invoice ${sale.invoiceNumber} recorded. Stock updated.`} /> : query.saved ? <FlashToast message="Changes saved. Stock updated." /> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Invoice</p>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {sale.invoiceNumber}
            {active ? null : <Badge variant="outline">Cancelled</Badge>}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {formatCalendarDate(sale.date)}
            {sale.customerName ? ` · ${sale.customerName}` : ""}
          </p>
        </div>
        {active && can(user.role, "sale.manage") ? (
          <div className="flex flex-wrap gap-2">
            <SaleActions saleId={sale.id} invoiceNumber={sale.invoiceNumber} itemCount={sale.items.length} />
          </div>
        ) : active && can(user.role, "request.create") ? (
          <SaleRequestButton saleId={sale.id} invoiceNumber={sale.invoiceNumber} />
        ) : null}
      </div>

      {active ? <PendingRequestsNotice count={pending} subject="sale" /> : null}

      {!active ? (
        <div className="mt-4 flex gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <BanIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            Cancelled{sale.cancelledAt ? ` on ${formatDateTime(sale.cancelledAt)}` : ""}. {sale.cancelReason ? `Reason: ${sale.cancelReason}. ` : ""}
            All stock from this sale was put back.
          </p>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">
          {sale.items.length} product{sale.items.length === 1 ? "" : "s"} sold
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {sale.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <Link href={`/inventory/${item.productId}`} className="font-medium hover:text-primary hover:underline">
                  {item.name}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {[item.brand, item.sku, item.isArchived ? "Archived" : null].filter(Boolean).join(" · ") || `Now ${formatQty(item.currentStock, item.unit)} in stock`}
                </p>
              </div>
              <p className="text-lg font-semibold tabular">{formatQty(item.quantity, item.unit)}</p>
            </li>
          ))}
        </ul>
      </section>

      {sale.note ? (
        <section className="mt-4 rounded-xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Note</h2>
          <p className="mt-1 whitespace-pre-line">{sale.note}</p>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        <ol className="grid gap-3 border-l pl-5">
          {sale.history.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute top-2 -left-[1.6rem] size-2.5 rounded-full bg-primary" />
              <p>{entry.summary}</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
