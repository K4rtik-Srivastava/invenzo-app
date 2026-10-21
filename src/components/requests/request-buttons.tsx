"use client";

import { useState } from "react";
import Link from "next/link";
import { BanIcon, ChevronDownIcon, Loader2Icon, MessageSquarePlusIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { useAction } from "@/hooks/use-action";
import { submitRequestAction } from "@/server/actions/requests";

function RequestMenuButton({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <MessageSquarePlusIcon /> Request change <ChevronDownIcon className="opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── On a sale page ─────────────────────────────────────────────────────────

export function SaleRequestButton({ saleId, invoiceNumber }: { saleId: string; invoiceNumber: string }) {
  const [cancelling, setCancelling] = useState(false);
  const { run, pending, fieldErrors } = useAction(submitRequestAction);
  return (
    <>
      <RequestMenuButton>
        <DropdownMenuItem asChild>
          <Link href={`/requests/new?type=sale&saleId=${saleId}`}>
            <PencilIcon /> Correct this sale
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => setCancelling(true)}>
          <BanIcon /> Cancel this sale
        </DropdownMenuItem>
      </RequestMenuButton>
      {cancelling ? (
        <Dialog open onOpenChange={setCancelling}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request to cancel invoice {invoiceNumber}</DialogTitle>
              <DialogDescription>If an Admin approves, the sale is cancelled and its stock goes back.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                run({ action: "CANCEL_SALE", saleId, reason: String(new FormData(event.currentTarget).get("reason")) });
              }}
            >
              <FormField label="Why?" htmlFor="cancel-req-reason" error={fieldErrors.reason}>
                <Textarea id="cancel-req-reason" name="reason" required maxLength={500} autoFocus placeholder="e.g. The bill was cancelled in the billing system" />
              </FormField>
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending ? <Loader2Icon className="animate-spin" /> : null}
                  Send request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
