import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SaleForm } from "@/components/sales/sale-form";
import { requirePageUser } from "@/server/session";
import { can } from "@/lib/permissions";
import { todayISO } from "@/lib/format";

export const metadata = { title: "Record sale" };

export default function NewSalePage() {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const user = await requirePageUser();
  // Admins record sales directly; Employees send them to an Admin for approval.
  const direct = can(user.role, "sale.create");
  if (!direct && !can(user.role, "request.create")) redirect("/?denied=1");
  const today = todayISO();
  return (
    <>
      <PageHeader
        title="Record sale"
        description={
          direct
            ? "Enter the invoice from your billing system. Stock is deducted when you save."
            : "Enter the invoice from your billing system. It goes to an Admin, and stock is deducted once they approve it."
        }
      />
      <SaleForm asRequest={!direct} today={today} cancelHref="/sales" initial={{ invoiceNumber: "", date: today, customerName: "", note: "", lines: [] }} />
    </>
  );
}
