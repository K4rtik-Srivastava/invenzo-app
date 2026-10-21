"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddUnitDialog } from "@/components/products/product-form";
import { useAction } from "@/hooks/use-action";
import { deleteUnitAction } from "@/server/actions/products";

type Unit = { id: string; name: string; isCustom: boolean; productCount: number };

export function UnitList({ units }: { units: Unit[] }) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Unit | null>(null);
  const remove = useAction(deleteUnitAction, { onSuccess: () => setRemoving(null) });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <PlusIcon /> Add unit
        </Button>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {units.map((unit) => (
          <li key={unit.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <span className="flex-1 font-medium">{unit.name}</span>
            {unit.isCustom ? <Badge variant="secondary">Custom</Badge> : null}
            <span className="w-24 text-right text-sm text-muted-foreground">
              {unit.productCount} product{unit.productCount === 1 ? "" : "s"}
            </span>
            {unit.isCustom && unit.productCount === 0 ? (
              <Button variant="ghost" size="icon" aria-label={`Remove ${unit.name}`} onClick={() => setRemoving(unit)}>
                <Trash2Icon />
              </Button>
            ) : (
              <span className="size-10" aria-hidden />
            )}
          </li>
        ))}
      </ul>
      <AddUnitDialog open={adding} onOpenChange={setAdding} onAdded={() => setAdding(false)} />
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Remove “${removing.name}”?`}
          description="It's not used by any product, so it can be removed safely."
          confirmLabel="Remove"
          destructive
          pending={remove.pending}
          onConfirm={() => remove.run({ unitId: removing.id })}
        />
      ) : null}
    </>
  );
}
