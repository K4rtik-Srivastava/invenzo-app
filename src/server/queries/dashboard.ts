import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { describeRequest } from "@/server/requests";
import { stockStatus } from "@/lib/stock-status";
import { todayISO } from "@/lib/format";

const fields = db.product.fields;
const active: Prisma.ProductWhereInput = { isArchived: false };
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function yesterdayISO(today: string) {
  const d = day(today);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function getStockSummary() {
  const [total, low, out] = await Promise.all([
    db.product.count({ where: active }),
    db.product.count({
      where: { ...active, currentStock: { gt: 0 }, reorderLevel: { gt: 0 }, AND: [{ currentStock: { lte: fields.reorderLevel } }] },
    }),
    db.product.count({ where: { ...active, currentStock: { lte: 0 } } }),
  ]);
  return { total, low, out };
}

/** Products that need restocking: out of stock first, then the lowest relative to their low-stock level. */
export async function getRestockList(limit = 8) {
  const rows = await db.$queryRaw<{ id: string; name: string; brand: string | null; currentStock: Prisma.Decimal; reorderLevel: Prisma.Decimal; unit: string }[]>`
    SELECT p.id, p.name, p.brand, p."currentStock", p."reorderLevel", u.name AS unit
    FROM product p JOIN unit u ON u.id = p."unitId"
    WHERE p."isArchived" = false
      AND (p."currentStock" <= 0 OR (p."reorderLevel" > 0 AND p."currentStock" <= p."reorderLevel"))
    ORDER BY (p."currentStock" <= 0) DESC, p."currentStock" / NULLIF(p."reorderLevel", 0) ASC NULLS FIRST, p.name ASC
    LIMIT ${limit}`;
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    unit: p.unit,
    currentStock: p.currentStock.toString(),
    reorderLevel: p.reorderLevel.toString(),
    status: stockStatus(p.currentStock.toString(), p.reorderLevel.toString()),
  }));
}

export async function getTodaySales(limit = 5) {
  const today = todayISO();
  const where = (iso: string): Prisma.SaleWhereInput => ({ status: "ACTIVE", date: day(iso) });
  const [count, yesterday, lines, recent] = await Promise.all([
    db.sale.count({ where: where(today) }),
    db.sale.count({ where: where(yesterdayISO(today)) }),
    db.saleItem.count({ where: { sale: where(today) } }),
    db.sale.findMany({
      where: where(today),
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);
  return {
    today,
    count,
    yesterday,
    lines,
    recent: recent.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName,
      createdAt: s.createdAt,
      by: s.createdBy.name,
      itemCount: s._count.items,
    })),
  };
}

export async function getRequestSummary({ requestedById, limit = 5 }: { requestedById?: string; limit?: number }) {
  const [pending, recent] = await Promise.all([
    db.changeRequest.count({ where: { status: "PENDING", requestedById } }),
    db.changeRequest.findMany({
      where: requestedById ? { requestedById } : { status: "PENDING" },
      orderBy: requestedById ? { createdAt: "desc" } : { createdAt: "asc" },
      take: limit,
      include: {
        product: { select: { name: true, unit: { select: { name: true } } } },
        sale: { select: { invoiceNumber: true } },
        requestedBy: { select: { name: true } },
      },
    }),
  ]);
  return {
    pending,
    recent: recent.map((r) => ({
      id: r.id,
      status: r.status,
      title: describeRequest(r, r),
      requestedBy: r.requestedBy.name,
      createdAt: r.createdAt,
      adminNote: r.adminNote,
    })),
  };
}

export async function getRecentActivity(limit = 8) {
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, summary: true, createdAt: true, entityType: true, entityId: true },
  });
}
