import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SaleForm } from "@/components/sales/sale-form";
import { requirePageUser } from "@/server/session";
import { getSale } from "@/server/queries/sales";
import { toISODate, todayISO } from "@/lib/format";

export const metadata = { title: "Request a change" };

// /requests/new?type=sale&saleId=…   (correct a sale)
// (New sales from Employees are sent from /sales/new.)
export default function NewRequestPage(props: PageProps<"/requests/new">) {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/requests/new">["searchParams"] }) {
  await requirePageUser({ permission: "request.create" });
  const { type, saleId } = await searchParams;

  if (type === "sale" && typeof saleId === "string") {
    const sale = await getSale(saleId);
    if (!sale) notFound();
    if (sale.status !== "ACTIVE") redirect(`/sales/${sale.id}`);
    return (
      <>
        <PageHeader title={`Request a correction to invoice ${sale.invoiceNumber}`} description="Make the sale match the bill. Stock changes only when an Admin approves." />
        <SaleForm
          asRequest
          saleId={sale.id}
          today={todayISO()}
          cancelHref={`/sales/${sale.id}`}
          initial={{
            invoiceNumber: sale.invoiceNumber,
            date: toISODate(sale.date),
            customerName: sale.customerName ?? "",
            note: sale.note ?? "",
            lines: sale.items.map((i) => ({ id: i.productId, name: i.name, unit: i.unit, quantity: i.quantity, available: String(Number(i.currentStock) + Number(i.quantity)) })),
          }}
        />
      </>
    );
  }

  notFound();
}
