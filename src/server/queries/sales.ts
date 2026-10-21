import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { invoiceKey, type SaleSearch } from "@/lib/validation/sales";

export const SALE_PAGE_SIZE = 25;

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);
const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Search by invoice number, customer or product (name / SKU), within a date range. */
export function saleWhere(filters: SaleSearch): Prisma.SaleWhereInput {
  const and: Prisma.SaleWhereInput[] = [];
  if (filters.status === "active") and.push({ status: "ACTIVE" });
  if (filters.status === "cancelled") and.push({ status: "CANCELLED" });
  if (filters.from) and.push({ date: { gte: toDate(filters.from) } });
  if (filters.to) and.push({ date: { lte: toDate(filters.to) } });
  if (filters.q) {
    const contains = { contains: escapeLike(filters.q), mode: "insensitive" } as const;
    and.push({
      OR: [
        { invoiceNumber: contains },
        { invoiceKey: { contains: escapeLike(invoiceKey(filters.q)) } },
        { customerName: contains },
        { items: { some: { product: { OR: [{ name: contains }, { sku: contains }] } } } },
      ],
    });
  }
  return { AND: and };
}

export async function searchSales(filters: SaleSearch) {
  const where = saleWhere(filters);
  const total = await db.sale.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / SALE_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await db.sale.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * SALE_PAGE_SIZE,
    take: SALE_PAGE_SIZE,
    select: {
      id: true,
      invoiceNumber: true,
      date: true,
      customerName: true,
      status: true,
      createdBy: { select: { name: true } },
      items: { select: { quantity: true, product: { select: { name: true, unit: { select: { name: true } } } } }, orderBy: { id: "asc" } },
    },
  });
  // An exact invoice-number match goes to the top, so typing a number finds that bill first.
  const exact = filters.q ? invoiceKey(filters.q) : null;
  rows.sort((a, b) => Number(invoiceKey(b.invoiceNumber) === exact) - Number(invoiceKey(a.invoiceNumber) === exact));
  return {
    total,
    page,
    pageCount,
    rows: rows.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      date: s.date,
      customerName: s.customerName,
      status: s.status,
      by: s.createdBy.name,
      itemCount: s.items.length,
      summary: s.items
        .slice(0, 3)
        .map((i) => `${i.product.name} × ${Number(i.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })}`)
        .join(", "),
    })),
  };
}

export async function getSale(id: string) {
  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      items: {
        orderBy: { id: "asc" },
        include: { product: { select: { id: true, name: true, sku: true, brand: true, isArchived: true, currentStock: true, unit: { select: { name: true } } } } },
      },
    },
  });
  if (!sale) return null;
  const history = await db.auditLog.findMany({
    where: { entityType: "sale", entityId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, summary: true, createdAt: true },
  });
  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    date: sale.date,
    customerName: sale.customerName,
    note: sale.note,
    status: sale.status,
    cancelReason: sale.cancelReason,
    cancelledAt: sale.cancelledAt,
    createdAt: sale.createdAt,
    by: sale.createdBy.name,
    items: sale.items.map((i) => ({
      productId: i.product.id,
      name: i.product.name,
      sku: i.product.sku,
      brand: i.product.brand,
      isArchived: i.product.isArchived,
      unit: i.product.unit.name,
      quantity: i.quantity.toString(),
      currentStock: i.product.currentStock.toString(),
    })),
    history,
  };
}

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;
