import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SaleForm } from "@/components/sales/sale-form";
import { requirePageUser } from "@/server/session";
import { getSale } from "@/server/queries/sales";
import { toISODate, todayISO } from "@/lib/format";

export const metadata = { title: "Edit sale" };

export default function EditSalePage(props: PageProps<"/sales/[id]/edit">) {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[28rem]" />}>
        <Form params={props.params} />
      </Suspense>
    </div>
  );
}

async function Form({ params }: { params: PageProps<"/sales/[id]/edit">["params"] }) {
  await requirePageUser({ permission: "sale.manage" });
  const { id } = await params;
  const sale = await getSale(id);
  if (!sale) notFound();
  if (sale.status !== "ACTIVE") redirect(`/sales/${id}`);
  return (
    <>
      <PageHeader title={`Edit invoice ${sale.invoiceNumber}`} description="Stock is adjusted by the difference when you save." />
      <SaleForm
        saleId={sale.id}
        today={todayISO()}
        cancelHref={`/sales/${sale.id}`}
        initial={{
          invoiceNumber: sale.invoiceNumber,
          date: toISODate(sale.date),
          customerName: sale.customerName ?? "",
          note: sale.note ?? "",
          // What's already on this sale can be kept, so it counts as available.
          lines: sale.items.map((i) => ({
            id: i.productId,
            name: i.name,
            unit: i.unit,
            quantity: i.quantity,
            available: String(Number(i.currentStock) + Number(i.quantity)),
          })),
        }}
      />
    </>
  );
}
