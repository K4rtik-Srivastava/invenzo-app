export type StockStatus = "in" | "low" | "out";

export function stockStatus(current: number | string, reorderLevel: number | string): StockStatus {
  const stock = Number(current);
  const reorder = Number(reorderLevel);
  if (stock <= 0) return "out";
  if (reorder > 0 && stock <= reorder) return "low";
  return "in";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  in: "In stock",
  low: "Low stock",
  out: "Out of stock",
};
