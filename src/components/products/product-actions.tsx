"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArchiveIcon, ArchiveRestoreIcon, ArrowDownUpIcon, Loader2Icon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { useAction } from "@/hooks/use-action";
import { adjustStockAction, archiveProductAction, deleteProductAction, restoreProductAction } from "@/server/actions/products";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = { productId: string; name: string; unit: string; currentStock: string; isArchived: boolean };

export function ProductActions(props: Props) {
  const [dialog, setDialog] = useState<"adjust" | "archive" | "restore" | "delete" | null>(null);
  const close = () => setDialog(null);
  return (
    <>
      {!props.isArchived ? (
        <Button onClick={() => setDialog("adjust")}>
          <ArrowDownUpIcon /> Adjust stock
        </Button>
      ) : null}
      <Button variant="outline" asChild>
        <Link href={`/inventory/${props.productId}/edit`}>
          <PencilIcon /> Edit
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {props.isArchived ? (
            <DropdownMenuItem onSelect={() => setDialog("restore")}>
              <ArchiveRestoreIcon /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDialog("archive")}>
              <ArchiveIcon /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "adjust" ? <AdjustStockDialog {...props} onClose={close} /> : null}
      {dialog === "archive" ? <ArchiveDialog {...props} onClose={close} /> : null}
      {dialog === "restore" ? <RestoreDialog {...props} onClose={close} /> : null}
      {dialog === "delete" ? <DeleteDialog {...props} onClose={close} /> : null}
    </>
  );
}

function AdjustStockDialog({ productId, name, unit, currentStock, onClose }: Props & { onClose: () => void }) {
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const { run, pending, fieldErrors } = useAction(adjustStockAction, { onSuccess: onClose });
  const qty = Number(quantity);
  const preview = Number.isFinite(qty) && qty > 0 ? Number(currentStock) + (direction === "IN" ? qty : -qty) : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run({ productId, direction, quantity, note: String(new FormData(event.currentTarget).get("note")) });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {name} · currently {formatQty(currentStock, unit)}. To record a sale, use Sales instead.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Direction">
            {(["IN", "OUT"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={direction === d}
                onClick={() => setDirection(d)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  direction === d ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted",
                )}
              >
                <span className="block font-medium">{d === "IN" ? "Stock in" : "Stock out"}</span>
                <span className="block text-sm text-muted-foreground">{d === "IN" ? "Delivery, correction up" : "Damaged, lost, correction down"}</span>
              </button>
            ))}
          </div>
          <FormField
            label={`Quantity (${unit})`}
            htmlFor="adjust-qty"
            error={fieldErrors.quantity}
            hint={preview !== null ? `New stock will be ${formatQty(preview, unit)}` : undefined}
          >
            <Input id="adjust-qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" autoFocus required autoComplete="off" />
          </FormField>
          <FormField label="Reason" htmlFor="adjust-note" error={fieldErrors.note}>
            <Input id="adjust-note" name="note" placeholder={direction === "IN" ? "e.g. Delivery from supplier, bill 4471" : "e.g. 2 broken in storage"} required maxLength={300} />
          </FormField>
          {preview !== null && preview < 0 ? (
            <p role="alert" className="text-sm text-destructive">
              That’s more than the {formatQty(currentStock, unit)} in stock.
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || (preview !== null && preview < 0)}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({ productId, name, onClose }: Props & { onClose: () => void }) {
  const { run, pending } = useAction(archiveProductAction, { onSuccess: onClose });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Archive ${name}?`}
      description="It will be hidden from the inventory list and can't be sold or adjusted. Its history is kept, and you can restore it any time."
      confirmLabel="Archive"
      pending={pending}
      onConfirm={() => run({ productId })}
    />
  );
}

function RestoreDialog({ productId, name, onClose }: Props & { onClose: () => void }) {
  const { run, pending } = useAction(restoreProductAction, { onSuccess: onClose });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Restore ${name}?`}
      description="It will appear in the inventory list again and can be sold."
      confirmLabel="Restore"
      pending={pending}
      onConfirm={() => run({ productId })}
    />
  );
}

function DeleteDialog({ productId, name, onClose }: Props & { onClose: () => void }) {
  const { run, pending } = useAction(deleteProductAction, { onSuccess: onClose });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Delete ${name}?`}
      description="This can't be undone. Products that have been sold or had stock adjusted can't be deleted; archive them instead."
      confirmLabel="Delete"
      destructive
      pending={pending}
      onConfirm={() => run({ productId })}
    />
  );
}
