import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { toCsv } from "@/server/spreadsheet";
import { can } from "@/lib/permissions";
import { IMPORT_COLUMNS } from "@/lib/import-columns";

// GET /api/export/import-template → a CSV with the right headers and one example row.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "product.import")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const csv = toCsv(
    IMPORT_COLUMNS.map((c) => ({ header: c.header })),
    [IMPORT_COLUMNS.map((c) => c.example)],
  );
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="product-import-template.csv"' },
  });
}
