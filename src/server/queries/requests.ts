import "server-only";
import type { Prisma, RequestStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { describeRequest } from "@/server/requests";
import { formatCalendarDate, formatQty } from "@/lib/format";
import type { RequestPayload } from "@/lib/validation/requests";
import type { REQUEST_STATUS_FILTERS } from "@/lib/validation/requests";

export const REQUEST_PAGE_SIZE = 25;

const STATUS: Record<(typeof REQUEST_STATUS_FILTERS)[number], RequestStatus | undefined> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
  all: undefined,
};

const describeInclude = {
  product: { select: { name: true, unit: { select: { name: true } } } },
  sale: { select: { invoiceNumber: true } },
} as const;

export async function listRequests({
  status,
  page,
  requestedById,
}: {
  status: (typeof REQUEST_STATUS_FILTERS)[number];
  page: number;
  requestedById?: string; // Employees only see their own
}) {
  const where: Prisma.ChangeRequestWhereInput = { status: STATUS[status], requestedById };
  const [total, counts] = await Promise.all([
    db.changeRequest.count({ where }),
    db.changeRequest.groupBy({ by: ["status"], where: { requestedById }, _count: true }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / REQUEST_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = await db.changeRequest.findMany({
    where,
    // Pending: oldest first (first come, first served). Others: newest first.
    orderBy: status === "pending" ? { createdAt: "asc" } : { createdAt: "desc" },
    skip: (safePage - 1) * REQUEST_PAGE_SIZE,
    take: REQUEST_PAGE_SIZE,
    include: { ...describeInclude, requestedBy: { select: { name: true } } },
  });
  return {
    total,
    page: safePage,
    pageCount,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<RequestStatus, number>>,
    rows: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      title: describeRequest(r, r),
      reason: r.reason,
      requestedBy: r.requestedBy.name,
      createdAt: r.createdAt,
      adminNote: r.adminNote,
    })),
  };
}

// ─── Request detail: a readable "before → after" view ────────────────────────

export type ChangeRow = { label: string; before?: string; after: string };
type ItemRow = { name: string; before?: string; after: string; stock?: string; short?: boolean };

export async function getRequest(id: string) {
  const request = await db.changeRequest.findUnique({
    where: { id },
    include: {
      ...describeInclude,
      requestedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { name: true } },
    },
  });
  if (!request) return null;
  const payload = request.payload as unknown as RequestPayload;

  let rows: ChangeRow[] = [];
  let items: ItemRow[] = [];

  const loadProducts = async (ids: string[]) =>
    new Map(
      (await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, currentStock: true, unit: { select: { name: true } } } })).map(
        (p) => [p.id, p],
      ),
    );

  switch (payload.action) {
    case "CREATE_SALE": {
      const s = payload.sale;
      const products = await loadProducts(s.items.map((i) => i.productId));
      const pending = request.status === "PENDING";
      items = s.items.map((i) => {
        const p = products.get(i.productId);
        const unit = p?.unit.name;
        const left = p ? p.currentStock.minus(i.quantity) : null;
        return {
          name: p?.name ?? "(deleted product)",
          after: formatQty(i.quantity, unit),
          // While it waits, show the Admin what approving would do to stock.
          stock: pending && p && left ? `In stock ${formatQty(p.currentStock, unit)} → ${left.isNegative() ? "not enough" : formatQty(left, unit)}` : undefined,
          short: pending && Boolean(left?.isNegative()),
        };
      });
      const header: [string, string | null][] = [
        ["Invoice number", s.invoiceNumber],
        ["Date", formatCalendarDate(s.date)],
        ["Customer", s.customerName],
        ["Note", s.note],
      ];
      rows = header.flatMap(([label, value]) => (value ? [{ label, after: value }] : []));
      break;
    }
    case "UPDATE_SALE": {
      const o = payload.original;
      const s = payload.sale;
      const ids = [...new Set([...o.items, ...s.items].map((i) => i.productId))];
      const products = await loadProducts(ids);
      const before = new Map(o.items.map((i) => [i.productId, i.quantity]));
      const after = new Map(s.items.map((i) => [i.productId, i.quantity]));
      items = ids.map((pid) => {
        const p = products.get(pid);
        const b = before.get(pid);
        const a = after.get(pid);
        return {
          name: p?.name ?? "(deleted product)",
          before: b ? formatQty(b, p?.unit.name) : "—",
          after: a ? formatQty(a, p?.unit.name) : "Removed",
        };
      });
      const header: [string, string | null, string | null][] = [
        ["Invoice number", o.invoiceNumber, s.invoiceNumber],
        ["Date", formatCalendarDate(o.date), formatCalendarDate(s.date)],
        ["Customer", o.customerName, s.customerName],
        ["Note", o.note, s.note],
      ];
      rows = header.filter(([, b, a]) => (b ?? "") !== (a ?? "")).map(([label, b, a]) => ({ label, before: b || "—", after: a || "—" }));
      break;
    }
    case "CANCEL_SALE": {
      const sale = request.saleId
        ? await db.sale.findUnique({ where: { id: request.saleId }, include: { items: { include: { product: { select: { name: true, unit: { select: { name: true } } } } } } } })
        : null;
      items = (sale?.items ?? []).map((i) => ({ name: i.product.name, after: `${formatQty(i.quantity, i.product.unit.name)} back to stock` }));
      break;
    }
  }

  return {
    id: request.id,
    action: payload.action,
    kind: request.kind,
    status: request.status,
    title: describeRequest(request, request),
    reason: request.reason,
    requestedBy: request.requestedBy,
    reviewedBy: request.reviewedBy?.name ?? null,
    reviewedAt: request.reviewedAt,
    adminNote: request.adminNote,
    createdAt: request.createdAt,
    saleId: request.saleId,
    rows,
    items,
  };
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequest>>>;

/** How many pending requests are open for a sale (shown as a notice on its page). */
export function pendingRequestsFor(where: { saleId: string }) {
  return db.changeRequest.count({ where: { ...where, status: "PENDING" } });
}
