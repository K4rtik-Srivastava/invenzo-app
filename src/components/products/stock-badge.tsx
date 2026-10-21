import { Badge } from "@/components/ui/badge";
import { STOCK_STATUS_LABEL, type StockStatus } from "@/lib/stock-status";
import { cn } from "@/lib/utils";

const STYLES: Record<StockStatus, string> = {
  in: "bg-success/10 text-success",
  low: "bg-warning/15 text-warning",
  out: "bg-destructive/10 text-destructive",
};

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", STYLES[status], className)}>
      {STOCK_STATUS_LABEL[status]}
    </Badge>
  );
}
