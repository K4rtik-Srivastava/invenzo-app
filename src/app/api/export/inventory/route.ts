import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/session";
import { db } from "@/server/db";
import { productOrder, productWhere } from "@/server/queries/products";
import { fileResponse, type Column } from "@/server/spreadsheet";
import { can } from "@/lib/permissions";
import { stockStatus, STOCK_STATUS_LABEL } from "@/lib/stock-status";
import { parseProductSearch } from "@/lib/validation/search";
import { todayISO } from "@/lib/format";

const MAX_ROWS = 50_000;

// GET /api/export/inventory?format=csv|xlsx&q=…&brand=…  (same filters as the Inventory page)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inventory.export")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const format = params.format === "xlsx" ? "xlsx" : "csv";
  const filters = parseProductSearch(params);
  const withCost = can(user.role, "product.viewCost");

  const products = await db.product.findMany({
    where: productWhere(filters, { canSeeArchived: can(user.role, "product.manage") }),
    orderBy: productOrder(filters.sort),
    take: MAX_ROWS,
    include: { unit: { select: { name: true } } },
  });

  const columns: Column[] = [
    { header: "Name", width: 36 },
    { header: "Brand", width: 18 },
    { header: "SKU", width: 16 },
    { header: "HSN code", width: 10 },
    { header: "Unit", width: 8 },
    { header: "Current stock", width: 14 },
    { header: "Low-stock level", width: 14 },
    { header: "Stock status", width: 13 },
    { header: "Opening stock", width: 14 },
    ...(withCost ? [{ header: "Purchase price", width: 14 }] : []),
    { header: "Selling price", width: 13 },
    { header: "GST %", width: 8 },
    { header: "Archived", width: 9 },
    { header: "Description", width: 50 },
  ];
  const num = (v: { toString(): string } | null) => (v === null ? null : Number(v.toString()));
  const rows = products.map((p) => [
    p.name,
    p.brand,
    p.sku,
    p.hsnCode,
    p.unit.name,
    num(p.currentStock),
    num(p.reorderLevel),
    STOCK_STATUS_LABEL[stockStatus(p.currentStock.toString(), p.reorderLevel.toString())],
    num(p.openingStock),
    ...(withCost ? [num(p.purchasePrice)] : []),
    num(p.sellingPrice),
    num(p.gstRate),
    p.isArchived ? "Yes" : "No",
    p.description,
  ]);
  return fileResponse(format, `inventory-${todayISO()}`, "Inventory", columns, rows);
}
