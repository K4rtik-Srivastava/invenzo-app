import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/session";
import { db } from "@/server/db";
import { saleWhere } from "@/server/queries/sales";
import { fileResponse, type Column } from "@/server/spreadsheet";
import { can } from "@/lib/permissions";
import { saleSearchSchema } from "@/lib/validation/sales";
import { todayISO, toISODate } from "@/lib/format";

const MAX_SALES = 20_000;

// GET /api/export/sales?format=csv|xlsx&q=…&from=…&to=…&status=…  (one row per product sold)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "sale.export")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const format = params.format === "xlsx" ? "xlsx" : "csv";
  const filters = saleSearchSchema.parse(params);

  const sales = await db.sale.findMany({
    where: saleWhere(filters),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: MAX_SALES,
    include: {
      createdBy: { select: { name: true } },
      items: { orderBy: { id: "asc" }, include: { product: { select: { name: true, sku: true, hsnCode: true, unit: { select: { name: true } } } } } },
    },
  });

  const columns: Column[] = [
    { header: "Invoice number", width: 16 },
    { header: "Date", width: 12 },
    { header: "Customer", width: 22 },
    { header: "Status", width: 11 },
    { header: "Product", width: 36 },
    { header: "SKU", width: 16 },
    { header: "HSN code", width: 10 },
    { header: "Quantity", width: 10 },
    { header: "Unit", width: 8 },
    { header: "Recorded by", width: 18 },
    { header: "Note", width: 30 },
    { header: "Cancel reason", width: 30 },
  ];
  const rows = sales.flatMap((s) =>
    s.items.map((i) => [
      s.invoiceNumber,
      toISODate(s.date),
      s.customerName,
      s.status === "ACTIVE" ? "Active" : "Cancelled",
      i.product.name,
      i.product.sku,
      i.product.hsnCode,
      Number(i.quantity.toString()),
      i.product.unit.name,
      s.createdBy.name,
      s.note,
      s.cancelReason,
    ]),
  );
  return fileResponse(format, `sales-${filters.from ?? "all"}-to-${filters.to ?? todayISO()}`, "Sales", columns, rows);
}
