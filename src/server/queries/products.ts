import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { stockStatus } from "@/lib/stock-status";
import { searchTerms, type ProductSearch, type ProductSort } from "@/lib/validation/search";

// Read-only queries for pages. Decimal values are turned into strings here so
// they can be passed to client components, and purchase price is only
// included when the caller is allowed to see it.

export const PRODUCT_PAGE_SIZE = 25;

const productFields = db.product.fields;

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Filters for the Inventory list. Every search word must appear in at least one searchable field. */
export function productWhere(filters: ProductSearch, { canSeeArchived }: { canSeeArchived: boolean }): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  if (!(canSeeArchived && filters.archived)) and.push({ isArchived: false });

  for (const term of searchTerms(filters.q)) {
    // Prisma passes % and _ straight to LIKE, so escape them to match literally.
    const contains = { contains: escapeLike(term), mode: "insensitive" } as const;
    and.push({ OR: [{ name: contains }, { brand: contains }, { hsnCode: contains }, { sku: contains }, { description: contains }] });
  }
  if (filters.brand) and.push({ brand: filters.brand });
  if (filters.unit) and.push({ unitId: filters.unit });

  if (filters.stock === "out") and.push({ currentStock: { lte: 0 } });
  if (filters.stock === "low") {
    and.push({ currentStock: { gt: 0 } }, { reorderLevel: { gt: 0 } }, { currentStock: { lte: productFields.reorderLevel } });
  }
  if (filters.stock === "in") {
    and.push({ currentStock: { gt: 0 } }, { OR: [{ reorderLevel: 0 }, { currentStock: { gt: productFields.reorderLevel } }] });
  }
  return { AND: and };
}

export function productOrder(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  const dir = sort.startsWith("-") ? "desc" : "asc";
  const key = sort.replace("-", "");
  const primary: Prisma.ProductOrderByWithRelationInput =
    key === "stock" ? { currentStock: dir } : key === "price" ? { sellingPrice: { sort: dir, nulls: "last" } } : { name: dir };
  // Tie-breakers keep pagination stable when values are equal.
  return [primary, { name: "asc" }, { id: "asc" }];
}

export async function searchProducts(filters: ProductSearch, options: { canSeeArchived: boolean }) {
  const where = productWhere(filters, options);
  const total = await db.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await db.product.findMany({
    where,
    orderBy: productOrder(filters.sort),
    skip: (page - 1) * PRODUCT_PAGE_SIZE,
    take: PRODUCT_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      brand: true,
      sku: true,
      hsnCode: true,
      currentStock: true,
      reorderLevel: true,
      sellingPrice: true,
      isArchived: true,
      unit: { select: { name: true } },
    },
  });
  return {
    total,
    page,
    pageCount,
    rows: rows.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      sku: p.sku,
      hsnCode: p.hsnCode,
      unit: p.unit.name,
      currentStock: p.currentStock.toString(),
      sellingPrice: p.sellingPrice?.toString() ?? null,
      isArchived: p.isArchived,
      status: stockStatus(p.currentStock.toString(), p.reorderLevel.toString()),
    })),
  };
}

export type ProductListRow = Awaited<ReturnType<typeof searchProducts>>["rows"][number];

/**
 * As-you-type search for the search bar: best matches first.
 * Exact SKU / HSN hits, then names starting with the search, then the closest
 * names (trigram similarity), then A–Z. Uses the trigram indexes, so it stays
 * fast with many thousands of products.
 */
export async function quickSearchProducts(q: string, { page = 1, pageSize = 8 } = {}) {
  const terms = searchTerms(q);
  if (terms.length === 0) return { total: 0, page: 1, pageCount: 1, rows: [] };
  const whole = terms.join(" ");
  const conditions = terms.map((term) => {
    const like = `%${escapeLike(term)}%`;
    return Prisma.sql`(p.name ILIKE ${like} OR p.brand ILIKE ${like} OR p."hsnCode" ILIKE ${like} OR p.sku ILIKE ${like} OR p.description ILIKE ${like})`;
  });
  const where = Prisma.sql`p."isArchived" = false AND ${Prisma.join(conditions, " AND ")}`;

  const [{ count }] = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM product p WHERE ${where}`;
  const total = Number(count);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const rows = await db.$queryRaw<
    { id: string; name: string; brand: string | null; sku: string | null; hsnCode: string | null; currentStock: Prisma.Decimal; reorderLevel: Prisma.Decimal; unit: string }[]
  >`
    SELECT p.id, p.name, p.brand, p.sku, p."hsnCode", p."currentStock", p."reorderLevel", u.name AS unit
    FROM product p JOIN unit u ON u.id = p."unitId"
    WHERE ${where}
    ORDER BY
      (lower(p.sku) = ${whole} OR p."hsnCode" = ${whole}) DESC,
      (lower(p.name) LIKE ${`${escapeLike(whole)}%`}) DESC,
      word_similarity(${whole}, lower(p.name)) DESC,
      p.name ASC, p.id ASC
    LIMIT ${pageSize} OFFSET ${(safePage - 1) * pageSize}`;

  return {
    total,
    page: safePage,
    pageCount,
    rows: rows.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      sku: p.sku,
      hsnCode: p.hsnCode,
      unit: p.unit,
      currentStock: p.currentStock.toString(),
      status: stockStatus(p.currentStock.toString(), p.reorderLevel.toString()),
    })),
  };
}

export type QuickSearchResult = Awaited<ReturnType<typeof quickSearchProducts>>;

export async function getProduct(id: string, { includeCost }: { includeCost: boolean }) {
  const p = await db.product.findUnique({
    where: { id },
    include: { unit: { select: { id: true, name: true } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    hsnCode: p.hsnCode,
    sku: p.sku,
    description: p.description,
    unitId: p.unit.id,
    unit: p.unit.name,
    purchasePrice: includeCost ? (p.purchasePrice?.toString() ?? null) : null,
    sellingPrice: p.sellingPrice?.toString() ?? null,
    gstRate: p.gstRate?.toString() ?? null,
    reorderLevel: p.reorderLevel.toString(),
    openingStock: p.openingStock.toString(),
    currentStock: p.currentStock.toString(),
    isArchived: p.isArchived,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    status: stockStatus(p.currentStock.toString(), p.reorderLevel.toString()),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

export const MOVEMENT_PAGE_SIZE = 20;

export async function getMovements(productId: string, page: number) {
  const where = { productId };
  const [total, rows] = await Promise.all([
    db.stockMovement.count({ where }),
    db.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * MOVEMENT_PAGE_SIZE,
      take: MOVEMENT_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        quantity: true,
        balanceAfter: true,
        note: true,
        createdAt: true,
        requestId: true,
        createdBy: { select: { name: true } },
        sale: { select: { id: true, invoiceNumber: true } },
      },
    }),
  ]);
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / MOVEMENT_PAGE_SIZE)),
    rows: rows.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity.toString(),
      balanceAfter: m.balanceAfter.toString(),
      note: m.note,
      createdAt: m.createdAt,
      requestId: m.requestId,
      by: m.createdBy.name,
      sale: m.sale,
    })),
  };
}

export async function getUnitsWithUsage() {
  const units = await db.unit.findMany({
    orderBy: [{ isCustom: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return units.map((u) => ({ id: u.id, name: u.name, isCustom: u.isCustom, productCount: u._count.products }));
}

export async function getUnits() {
  return db.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function getBrands() {
  const rows = await db.product.findMany({
    where: { brand: { not: null } },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
    select: { brand: true },
  });
  return rows.map((r) => r.brand!).filter(Boolean);
}
