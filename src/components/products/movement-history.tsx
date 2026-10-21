import Link from "next/link";
import { ArrowDownLeftIcon, ArrowUpRightIcon, FlagIcon, ReceiptTextIcon, Undo2Icon } from "lucide-react";
import type { MovementType } from "@/generated/prisma/enums";
import { formatDateTime, formatQty, formatSignedQty } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_INFO: Record<MovementType, { label: string; icon: typeof FlagIcon; tone: string }> = {
  OPENING: { label: "Opening stock", icon: FlagIcon, tone: "bg-muted text-foreground" },
  STOCK_IN: { label: "Stock in", icon: ArrowDownLeftIcon, tone: "bg-success/10 text-success" },
  STOCK_OUT: { label: "Stock out", icon: ArrowUpRightIcon, tone: "bg-destructive/10 text-destructive" },
  SALE: { label: "Sold", icon: ReceiptTextIcon, tone: "bg-primary/10 text-primary" },
  SALE_REVERSAL: { label: "Sale reversed", icon: Undo2Icon, tone: "bg-warning/15 text-warning" },
};

export type MovementRow = {
  id: string;
  type: MovementType;
  quantity: string;
  balanceAfter: string;
  note: string | null;
  createdAt: Date;
  requestId: string | null;
  by: string;
  sale: { id: string; invoiceNumber: string } | null;
};

export function MovementHistory({ rows, unit }: { rows: MovementRow[]; unit: string }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">No stock movements yet.</p>;
  }
  return (
    <ol className="divide-y rounded-xl border bg-card">
      {rows.map((m) => {
        const info = TYPE_INFO[m.type];
        const Icon = info.icon;
        return (
          <li key={m.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
            <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", info.tone)}>
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {info.label}
                {m.sale ? (
                  <>
                    {" on invoice "}
                    <Link href={`/sales/${m.sale.id}`} className="text-primary hover:underline">
                      {m.sale.invoiceNumber}
                    </Link>
                  </>
                ) : null}
              </p>
              {m.note && m.type !== "OPENING" ? <p className="text-muted-foreground">{m.note}</p> : null}
              <p className="text-sm text-muted-foreground">
                {m.by} · {formatDateTime(m.createdAt)}
                {m.requestId ? (
                  <>
                    {" · "}
                    <Link href={`/requests/${m.requestId}`} className="hover:underline">
                      via request
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <div className="text-right">
              <p className={cn("font-semibold tabular", Number(m.quantity) < 0 ? "text-destructive" : "text-success")}>
                {formatSignedQty(m.quantity, unit)}
              </p>
              <p className="text-sm text-muted-foreground tabular">→ {formatQty(m.balanceAfter, unit)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
