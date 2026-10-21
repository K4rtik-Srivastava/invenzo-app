import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { startOfDayInZone } from "@/lib/format";
import { z } from "zod";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_TYPES = ["product", "sale", "request", "user", "unit"] as const;

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const isoDate = z.preprocess(first, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined));

export const auditSearchSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(100).optional().catch(undefined).transform((v) => v || undefined)),
  actor: z.preprocess(first, z.string().max(64).optional().catch(undefined).transform((v) => v || undefined)),
  type: z.preprocess(first, z.enum(AUDIT_TYPES).optional().catch(undefined)),
  from: isoDate,
  to: isoDate,
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1).default(1)),
});
export type AuditSearch = z.output<typeof auditSearchSchema>;

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function searchAudit(filters: AuditSearch) {
  const where: Prisma.AuditLogWhereInput = {
    actorId: filters.actor,
    entityType: filters.type,
    summary: filters.q ? { contains: escapeLike(filters.q), mode: "insensitive" } : undefined,
    createdAt:
      filters.from || filters.to
        ? {
            gte: filters.from ? startOfDayInZone(filters.from) : undefined,
            lt: filters.to ? startOfDayInZone(nextDay(filters.to)) : undefined,
          }
        : undefined,
  };
  const total = await db.auditLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    select: { id: true, action: true, entityType: true, entityId: true, summary: true, createdAt: true, actor: { select: { name: true } } },
  });
  return { total, page, pageCount, rows };
}

export function auditActors() {
  return db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Where an audit entry's "open" link should go. */
export function auditHref(entityType: string, entityId: string | null) {
  if (!entityId) return null;
  if (entityType === "product") return `/inventory/${entityId}`;
  if (entityType === "sale") return `/sales/${entityId}`;
  if (entityType === "request") return `/requests/${entityId}`;
  if (entityType === "user") return "/users";
  if (entityType === "unit") return "/inventory/units";
  return null;
}
