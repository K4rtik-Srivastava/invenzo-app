"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { useAction } from "@/hooks/use-action";
import { createProductAction, createUnitAction, updateProductAction } from "@/server/actions/products";

export type ProductFormValues = {
  name: string;
  brand: string;
  hsnCode: string;
  sku: string;
  description: string;
  unitId: string;
  purchasePrice: string;
  sellingPrice: string;
  gstRate: string;
  reorderLevel: string;
  openingStock: string;
};

const EMPTY: ProductFormValues = {
  name: "",
  brand: "",
  hsnCode: "",
  sku: "",
  description: "",
  unitId: "",
  purchasePrice: "",
  sellingPrice: "",
  gstRate: "",
  reorderLevel: "0",
  openingStock: "0",
};

const GST_SUGGESTIONS = ["0", "5", "12", "18", "28", "40"];

export function ProductForm({
  productId,
  initial,
  units: initialUnits,
  brands,
  cancelHref,
}: {
  productId?: string; // set when editing
  initial?: Partial<ProductFormValues>;
  units: { id: string; name: string }[];
  brands: string[];
  cancelHref: string;
}) {
  const editing = Boolean(productId);
  const [units, setUnits] = useState(initialUnits);
  const [unitId, setUnitId] = useState(initial?.unitId ?? initialUnits.find((u) => u.name === "pcs")?.id ?? "");
  const [addingUnit, setAddingUnit] = useState(false);
  const values = { ...EMPTY, ...initial };

  const create = useAction(createProductAction);
  const update = useAction(updateProductAction);
  const { pending, fieldErrors } = editing ? update : create;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: keyof ProductFormValues) => String(form.get(key) ?? "");
    const fields = {
      name: text("name"),
      brand: text("brand"),
      hsnCode: text("hsnCode"),
      sku: text("sku"),
      description: text("description"),
      unitId,
      purchasePrice: text("purchasePrice"),
      sellingPrice: text("sellingPrice"),
      gstRate: text("gstRate"),
      reorderLevel: text("reorderLevel") || "0",
    };
    if (editing) update.run({ productId: productId!, ...fields });
    else create.run({ ...fields, openingStock: text("openingStock") || "0" });
  }

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-8">
        <Section title="Product">
          <FormField label="Product name *" htmlFor="name" error={fieldErrors.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={values.name} required maxLength={200} autoFocus={!editing} />
          </FormField>
          <FormField label="Brand / manufacturer" htmlFor="brand" error={fieldErrors.brand}>
            <Input id="brand" name="brand" defaultValue={values.brand} list="brand-options" maxLength={100} autoComplete="off" />
            <datalist id="brand-options">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </FormField>
          <FormField label="SKU / item code" htmlFor="sku" error={fieldErrors.sku} hint="Optional. Must be unique.">
            <Input id="sku" name="sku" defaultValue={values.sku} maxLength={64} autoComplete="off" />
          </FormField>
          <FormField label="HSN code" htmlFor="hsnCode" error={fieldErrors.hsnCode} hint="2 to 8 digits.">
            <Input
              id="hsnCode"
              name="hsnCode"
              defaultValue={values.hsnCode}
              inputMode="numeric"
              pattern="\d{2,8}"
              maxLength={8}
              autoComplete="off"
            />
          </FormField>
          <FormField label="Unit of measurement *" htmlFor="unitId" error={fieldErrors.unitId}>
            <div className="flex gap-2">
              <NativeSelect id="unitId" value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
                <option value="" disabled>
                  Choose…
                </option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
              <Button type="button" variant="outline" size="icon" onClick={() => setAddingUnit(true)} aria-label="Add a new unit">
                <PlusIcon />
              </Button>
            </div>
          </FormField>
          <FormField label="Description & technical notes" htmlFor="description" error={fieldErrors.description} className="sm:col-span-2">
            <Textarea id="description" name="description" defaultValue={values.description} rows={4} maxLength={5000} />
          </FormField>
        </Section>

        <Section title="Stock">
          {editing ? (
            <div className="grid gap-1.5">
              <p className="text-[0.95rem] font-medium">Opening stock</p>
              <p className="flex h-10 items-center text-muted-foreground">
                {values.openingStock} · change stock with “Adjust stock” on the product page
              </p>
            </div>
          ) : (
            <FormField label="Opening stock" htmlFor="openingStock" error={fieldErrors.openingStock} hint="How many you have right now.">
              <Input id="openingStock" name="openingStock" defaultValue={values.openingStock} inputMode="decimal" autoComplete="off" />
            </FormField>
          )}
          <FormField
            label="Low-stock level"
            htmlFor="reorderLevel"
            error={fieldErrors.reorderLevel}
            hint="Warn me when stock falls to this."
          >
            <Input id="reorderLevel" name="reorderLevel" defaultValue={values.reorderLevel} inputMode="decimal" autoComplete="off" />
          </FormField>
        </Section>

        <Section title="Prices (for reference)">
          <FormField label="Purchase price (₹)" htmlFor="purchasePrice" error={fieldErrors.purchasePrice} hint="Only Admins can see this.">
            <Input id="purchasePrice" name="purchasePrice" defaultValue={values.purchasePrice} inputMode="decimal" autoComplete="off" />
          </FormField>
          <FormField label="Selling price (₹)" htmlFor="sellingPrice" error={fieldErrors.sellingPrice}>
            <Input id="sellingPrice" name="sellingPrice" defaultValue={values.sellingPrice} inputMode="decimal" autoComplete="off" />
          </FormField>
          <FormField label="GST rate (%)" htmlFor="gstRate" error={fieldErrors.gstRate}>
            <Input id="gstRate" name="gstRate" defaultValue={values.gstRate} inputMode="decimal" list="gst-options" autoComplete="off" />
            <datalist id="gst-options">
              {GST_SUGGESTIONS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </FormField>
        </Section>

        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {editing ? "Save changes" : "Add product"}
          </Button>
        </div>
      </form>

      <AddUnitDialog
        open={addingUnit}
        onOpenChange={setAddingUnit}
        onAdded={(unit) => {
          setUnits((current) => [...current, unit].sort((a, b) => a.name.localeCompare(b.name)));
          setUnitId(unit.id);
          setAddingUnit(false);
        }}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-3 text-lg font-semibold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function AddUnitDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (unit: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const { run, pending, fieldErrors } = useAction(createUnitAction, {
    onSuccess: (result) => {
      if (result.data) onAdded(result.data);
      setName("");
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a unit</DialogTitle>
          <DialogDescription>For example “carton”, “sq ft” or “tin”.</DialogDescription>
        </DialogHeader>
        <FormField label="Unit name" htmlFor="unit-name" error={fieldErrors.name}>
          <Input
            id="unit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run({ name });
              }
            }}
          />
        </FormField>
        <DialogFooter>
          <Button type="button" disabled={pending} onClick={() => run({ name })}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Add unit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
