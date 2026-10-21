import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type AuditEntry = {
  actorId: string | null;
  action: string; // e.g. "user.create", "product.update", "sale.cancel"
  entityType: "user" | "product" | "unit" | "sale" | "request";
  entityId?: string | null;
  summary: string; // a sentence a person can read in the audit log
  before?: unknown;
  after?: unknown;
};

// Always called inside the same transaction as the change it describes,
// so a change can never happen without its audit record (or vice versa).
export function audit(tx: Tx, entry: AuditEntry) {
  return tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: toJson(entry.before),
      after: toJson(entry.after),
    },
  });
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  // Decimal and Date values become strings.
  return JSON.parse(JSON.stringify(value));
}
