"use client";

import { useState } from "react";
import Link from "next/link";
import { BanIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { useAction } from "@/hooks/use-action";
import { cancelSaleAction } from "@/server/actions/sales";

export function SaleActions({ saleId, invoiceNumber, itemCount }: { saleId: string; invoiceNumber: string; itemCount: number }) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending, fieldErrors } = useAction(cancelSaleAction, { onSuccess: () => setCancelling(false) });
  return (
    <>
      <Button variant="outline" asChild>
        <Link href={`/sales/${saleId}/edit`}>
          <PencilIcon /> Edit
        </Link>
      </Button>
      <Button variant="destructive" onClick={() => setCancelling(true)}>
        <BanIcon /> Cancel sale
      </Button>
      {cancelling ? (
        <ConfirmDialog
          open
          onOpenChange={setCancelling}
          title={`Cancel invoice ${invoiceNumber}?`}
          description={`Stock for all ${itemCount} product${itemCount === 1 ? "" : "s"} will be put back. The sale stays in the records as cancelled, and the invoice number can be entered again.`}
          confirmLabel="Cancel sale"
          destructive
          pending={pending}
          onConfirm={() => run({ saleId, reason })}
        >
          <FormField label="Reason" htmlFor="cancel-reason" error={fieldErrors.reason}>
            <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Bill cancelled, entered by mistake" maxLength={300} autoFocus />
          </FormField>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
