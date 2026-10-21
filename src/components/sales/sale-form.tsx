"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { AlertTriangleIcon, Loader2Icon, PackageSearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { ProductPicker, type PickedProduct } from "@/components/sales/product-picker";
import { useAction } from "@/hooks/use-action";
import { createSaleAction, updateSaleAction } from "@/server/actions/sales";
import { submitRequestAction } from "@/server/actions/requests";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SaleLine = PickedProduct & { quantity: string };

export type SaleFormInitial = {
  invoiceNumber: string;
  date: string;
  customerName: string;
  note: string;
  lines: SaleLine[]; // `available` = stock that can go on this sale (incl. what it already holds)
};

const QTY_PATTERN = /^\d{1,11}(\.\d{1,3})?$/;

export function SaleForm({
  saleId,
  initial,
  today,
  cancelHref,
  asRequest = false,
}: {
  saleId?: string;
  initial: SaleFormInitial;
  today: string;
  cancelHref: string;
  asRequest?: boolean; // Employees: send the sale (or correction) to an Admin for approval
}) {
  const editing = Boolean(saleId);
  const [lines, setLines] = useState<SaleLine[]>(initial.lines);
  const pickerRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());
  const create = useAction(createSaleAction);
  const update = useAction(updateSaleAction);
  const request = useAction(submitRequestAction);
  const { pending, fieldErrors, details } = asRequest ? request : editing ? update : create;

  const problems = lines.map((line) => {
    if (!line.quantity) return "Enter a quantity.";
    if (!QTY_PATTERN.test(line.quantity) || Number(line.quantity) <= 0) return "Enter a number greater than zero (up to 3 decimals).";
    if (Number(line.quantity) > Number(line.available)) return `Only ${formatQty(line.available, line.unit)} available.`;
    return null;
  });
  const [showProblems, setShowProblems] = useState(false);

  function addLine(product: PickedProduct) {
    setLines((current) => [...current, { ...product, quantity: "" }]);
    // Jump straight to the new line's quantity box.
    requestAnimationFrame(() => qtyRefs.current.get(product.id)?.focus());
  }

  function setQuantity(id: string, quantity: string) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, quantity: quantity.replace(",", ".") } : l)));
  }

  function removeLine(id: string) {
    setLines((current) => current.filter((l) => l.id !== id));
    pickerRef.current?.focus();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowProblems(true);
    if (lines.length === 0) {
      pickerRef.current?.focus();
      return;
    }
    const firstProblem = problems.findIndex(Boolean);
    if (firstProblem >= 0) {
      qtyRefs.current.get(lines[firstProblem].id)?.focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    const fields = {
      invoiceNumber: String(form.get("invoiceNumber")),
      date: String(form.get("date")),
      customerName: String(form.get("customerName")),
      note: String(form.get("note")),
      items: lines.map((l) => ({ productId: l.id, quantity: l.quantity })),
    };
    if (asRequest && editing) request.run({ action: "UPDATE_SALE", saleId: saleId!, reason: String(form.get("reason") ?? ""), sale: fields });
    else if (asRequest) request.run({ action: "CREATE_SALE", sale: fields });
    else if (editing) update.run({ saleId: saleId!, ...fields });
    else create.run(fields);
  }

  // Enter moves on instead of saving by accident; Ctrl/⌘+Enter saves.
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;
    if (event.key !== "Enter" || target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    } else if (target.dataset.qty !== undefined) {
      event.preventDefault();
      pickerRef.current?.focus();
    } else if (target.getAttribute("role") !== "combobox") {
      event.preventDefault();
    }
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="grid gap-8" noValidate>
      {asRequest && editing ? (
        <FormField label="What's wrong with this sale? *" htmlFor="reason" error={fieldErrors.reason} hint="Your Admin will see this when reviewing the request.">
          <Textarea id="reason" name="reason" required maxLength={500} rows={2} autoFocus />
        </FormField>
      ) : null}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Invoice details</legend>
        <FormField
          label="Invoice number *"
          htmlFor="invoiceNumber"
          error={fieldErrors.invoiceNumber}
          hint="Exactly as printed on the bill from your billing system."
        >
          <Input id="invoiceNumber" name="invoiceNumber" defaultValue={initial.invoiceNumber} required maxLength={50} autoFocus={!editing} autoComplete="off" autoCapitalize="characters" />
        </FormField>
        <FormField label="Sale date *" htmlFor="date" error={fieldErrors.date}>
          <Input id="date" name="date" type="date" defaultValue={initial.date} max={today} required />
        </FormField>
        <FormField label="Customer (optional)" htmlFor="customerName" error={fieldErrors.customerName}>
          <Input id="customerName" name="customerName" defaultValue={initial.customerName} maxLength={100} autoComplete="off" />
        </FormField>
        <FormField label="Note (optional)" htmlFor="note" error={fieldErrors.note}>
          <Textarea id="note" name="note" defaultValue={initial.note} maxLength={500} rows={1} className="min-h-10" />
        </FormField>
        {details?.existingSaleId ? (
          <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm sm:col-span-2">
            <AlertTriangleIcon className="size-4 text-warning" /> This invoice is already recorded.{" "}
            <Link href={`/sales/${details.existingSaleId}`} className="font-medium text-primary hover:underline">
              Open it
            </Link>
          </p>
        ) : details?.pendingRequestId ? (
          <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm sm:col-span-2">
            <AlertTriangleIcon className="size-4 text-warning" /> This invoice is waiting for approval.{" "}
            <Link href={`/requests/${details.pendingRequestId}`} className="font-medium text-primary hover:underline">
              Open the request
            </Link>
          </p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-lg font-semibold">Products sold</legend>
        {lines.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-muted-foreground">
            <PackageSearchIcon className="size-5 shrink-0" />
            Search below to add the products on this invoice.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {lines.map((line, index) => {
              const problem = showProblems || line.quantity ? problems[index] : null;
              const remaining = Number(line.available) - Number(line.quantity || 0);
              return (
                <li key={line.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_12rem_auto] sm:items-center sm:gap-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{line.name}</p>
                    <p className="text-sm text-muted-foreground tabular">
                      {formatQty(line.available, line.unit)} available
                      {!problem && line.quantity && remaining >= 0 ? ` · ${formatQty(remaining, line.unit)} left after this sale` : null}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 gap-1">
                      <div className="relative">
                        <Input
                          ref={(el) => {
                            if (el) qtyRefs.current.set(line.id, el);
                            else qtyRefs.current.delete(line.id);
                          }}
                          data-qty=""
                          aria-label={`Quantity of ${line.name}`}
                          aria-invalid={Boolean(problem)}
                          value={line.quantity}
                          onChange={(e) => setQuantity(line.id, e.target.value)}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="Qty"
                          className="pr-14 text-right tabular"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{line.unit}</span>
                      </div>
                      {problem ? (
                        <p role="alert" className="text-sm text-destructive">
                          {problem}
                        </p>
                      ) : null}
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${line.name}`} onClick={() => removeLine(line.id)}>
                      <XIcon />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <ProductPicker inputRef={pickerRef} excludeIds={lines.map((l) => l.id)} onSelect={addLine} />
        {showProblems && lines.length === 0 ? (
          <p role="alert" className="text-sm text-destructive">
            Add at least one product.
          </p>
        ) : null}
        {fieldErrors.items ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.items[0]}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
        <p className="hidden text-sm text-muted-foreground sm:mr-auto sm:block">Tip: press Ctrl+Enter (⌘+Enter on Mac) to save.</p>
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending} className={cn(lines.length > 0 && "min-w-40")}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {asRequest && editing
            ? "Send request"
            : editing
              ? "Save changes"
              : `${asRequest ? "Send for approval" : "Record sale"}${lines.length > 0 ? ` (${lines.length} product${lines.length === 1 ? "" : "s"})` : ""}`}
        </Button>
      </div>
    </form>
  );
}
