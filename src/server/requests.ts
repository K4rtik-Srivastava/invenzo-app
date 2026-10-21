import { Prisma, type ChangeRequest, type RequestAction } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { cancelSaleTx, checkInvoiceFree, createSaleTx, updateSaleTx } from "@/server/sales";
import { isUniqueViolation } from "@/server/users";
import { formatQty } from "@/lib/format";
import { invoiceKey, saleFields, type SaleInput } from "@/lib/validation/sales";
import type { RequestPayload, SubmitRequestInput } from "@/lib/validation/requests";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; name: string };

const KIND: Record<RequestAction, "INVENTORY" | "SALES"> = {
  CREATE_PRODUCT: "INVENTORY",
  UPDATE_PRODUCT: "INVENTORY",
  ADJUST_STOCK: "INVENTORY",
  CREATE_SALE: "SALES",
  UPDATE_SALE: "SALES",
  CANCEL_SALE: "SALES",
};

/** Stored payloads keep empty fields as null; forms send "". Convert back before re-checking. */
const blanks = <T extends Record<string, unknown>>(values: T) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === null ? "" : v])) as { [K in keyof T]: Exclude<T[K], null> | string };

/** Early warning for the Employee; stock is checked again (and taken) when an Admin approves. */
async function checkCanSell(sale: SaleInput) {
  const products = await db.product.findMany({
    where: { id: { in: sale.items.map((i) => i.productId) } },
    select: { id: true, name: true, isArchived: true, currentStock: true, unit: { select: { name: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of sale.items) {
    const product = byId.get(item.productId);
    if (!product) throw new AppError("One of the products no longer exists. Please remove it and try again.");
    if (product.isArchived) throw new AppError(`${product.name} is archived and can't be sold.`);
    if (product.currentStock.lessThan(item.quantity)) {
      throw new AppError(`Not enough stock for ${product.name}: only ${formatQty(product.currentStock, product.unit.name)} available, ${formatQty(item.quantity, product.unit.name)} needed.`);
    }
  }
}

async function saleSnapshot(saleId: string) {
  const sale = await db.sale.findUnique({ where: { id: saleId }, include: { items: { orderBy: { id: "asc" } } } });
  if (!sale) throw new AppError("That sale no longer exists.");
  if (sale.status !== "ACTIVE") throw new AppError("This sale has been cancelled, so it can't be changed.");
  const snapshot: SaleInput = {
    invoiceNumber: sale.invoiceNumber,
    date: sale.date.toISOString().slice(0, 10),
    customerName: sale.customerName,
    note: sale.note,
    items: sale.items.map((i) => ({ productId: i.productId, quantity: i.quantity.toString() })),
  };
  return { sale, snapshot };
}

// ─── Submit (Employees) ─────────────────────────────────────────────────────

export async function submitRequest(actor: Actor, input: SubmitRequestInput) {
  let payload: RequestPayload;
  let saleId: string | null = null;

  switch (input.action) {
    case "CREATE_SALE": {
      await checkCanSell(input.sale);
      payload = { action: "CREATE_SALE", sale: input.sale, invoiceKey: invoiceKey(input.sale.invoiceNumber) };
      break;
    }
    case "UPDATE_SALE": {
      const { sale, snapshot } = await saleSnapshot(input.saleId);
      payload = { action: "UPDATE_SALE", sale: input.sale, original: snapshot, saleUpdatedAt: sale.updatedAt.toISOString() };
      saleId = sale.id;
      break;
    }
    case "CANCEL_SALE": {
      const { sale } = await saleSnapshot(input.saleId);
      payload = { action: "CANCEL_SALE" };
      saleId = sale.id;
      break;
    }
  }

  return db.$transaction(async (tx) => {
    if (input.action === "CREATE_SALE") await checkInvoiceFree(tx, input.sale.invoiceNumber);
    const request = await tx.changeRequest.create({
      data: {
        kind: KIND[input.action],
        action: input.action,
        payload: payload as unknown as Prisma.InputJsonValue,
        reason: input.action === "CREATE_SALE" ? "" : input.reason,
        saleId,
        requestedById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "request.submit",
      entityType: "request",
      entityId: request.id,
      summary: `${actor.name} requested: ${await describe(tx, request)}`,
    });
    return request;
  });
}

// ─── Review (Admins) ────────────────────────────────────────────────────────

async function lockPending(tx: Tx, requestId: string) {
  await tx.$queryRaw`SELECT id FROM change_request WHERE id = ${requestId} FOR UPDATE`;
  const request = await tx.changeRequest.findUnique({ where: { id: requestId }, include: { requestedBy: { select: { name: true } } } });
  if (!request) throw new AppError("That request no longer exists.");
  if (request.status !== "PENDING") throw new AppError(`This request was already ${request.status.toLowerCase()}.`);
  return request;
}

/** Applies the requested change and marks the request approved, all in one transaction. */
export async function approveRequest(admin: Actor, requestId: string, note: string | null) {
  try {
    return await db.$transaction(async (tx) => {
      const request = await lockPending(tx, requestId);
      const payload = request.payload as unknown as RequestPayload;
      const options = { requestId: request.id };
      let saleId = request.saleId;

      switch (payload.action) {
        case "CREATE_SALE": {
          const enteredBy = { id: request.requestedById, name: request.requestedBy.name };
          const sale = await createSaleTx(tx, admin, saleFields.parse(blanks(payload.sale)), { ...options, enteredBy });
          saleId = sale.id;
          break;
        }
        case "UPDATE_SALE": {
          if (!request.saleId) throw new AppError("The sale in this request no longer exists. Reject the request instead.");
          await tx.$queryRaw`SELECT id FROM sale WHERE id = ${request.saleId} FOR UPDATE`;
          const sale = await tx.sale.findUniqueOrThrow({ where: { id: request.saleId } });
          if (sale.updatedAt.toISOString() !== payload.saleUpdatedAt) {
            throw new AppError("This sale was changed after the request was made, so approving it could undo that change. Reject it and ask for a new request.");
          }
          await updateSaleTx(tx, admin, request.saleId, saleFields.parse(blanks(payload.sale)), options);
          break;
        }
        case "CANCEL_SALE": {
          if (!request.saleId) throw new AppError("The sale in this request no longer exists. Reject the request instead.");
          await cancelSaleTx(tx, admin, request.saleId, `${request.reason} (requested by ${request.requestedBy.name})`, options);
          break;
        }
        default:
          throw new AppError("Employees can no longer ask for product or stock changes. Reject this request, and make the change yourself if it's needed.");
      }

      const updated = await tx.changeRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date(), adminNote: note, saleId },
      });
      await audit(tx, {
        actorId: admin.id,
        action: "request.approve",
        entityType: "request",
        entityId: request.id,
        summary: `${admin.name} approved ${request.requestedBy.name}'s request: ${await describe(tx, updated)}`,
      });
      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("This invoice number is already on another sale. Reject the request and ask for a corrected one.");
    }
    throw error;
  }
}

export async function rejectRequest(admin: Actor, requestId: string, note: string) {
  return db.$transaction(async (tx) => {
    const request = await lockPending(tx, requestId);
    const updated = await tx.changeRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", reviewedById: admin.id, reviewedAt: new Date(), adminNote: note },
    });
    await audit(tx, {
      actorId: admin.id,
      action: "request.reject",
      entityType: "request",
      entityId: request.id,
      summary: `${admin.name} rejected ${request.requestedBy.name}'s request: ${await describe(tx, updated)} (${note})`,
    });
    return updated;
  });
}

// ─── A one-line description, e.g. "Record invoice B-12 (2 products)" ────────

type DescribeContext = { product: { name: string; unit: { name: string } } | null; sale: { invoiceNumber: string } | null };

export function describeRequest(request: Pick<ChangeRequest, "payload">, { product, sale }: DescribeContext) {
  const payload = request.payload as unknown as RequestPayload;
  switch (payload.action) {
    case "CREATE_SALE": {
      const count = payload.sale.items.length;
      return `Record invoice ${payload.sale.invoiceNumber} (${count} product${count === 1 ? "" : "s"})`;
    }
    case "UPDATE_SALE":
      return `Correct invoice ${sale?.invoiceNumber ?? ""}`.trim();
    case "CANCEL_SALE":
      return `Cancel invoice ${sale?.invoiceNumber ?? ""}`.trim();
    case "CREATE_PRODUCT":
      return "Add a new product";
    case "UPDATE_PRODUCT":
      return `Edit ${product?.name ?? "a product"}`;
    case "ADJUST_STOCK":
      return `Correct the stock of ${product?.name ?? "a product"}`;
  }
}

async function describe(tx: Tx, request: Pick<ChangeRequest, "payload" | "productId" | "saleId">) {
  const [product, sale] = await Promise.all([
    request.productId ? tx.product.findUnique({ where: { id: request.productId }, select: { name: true, unit: { select: { name: true } } } }) : null,
    request.saleId ? tx.sale.findUnique({ where: { id: request.saleId }, select: { invoiceNumber: true } }) : null,
  ]);
  return describeRequest(request, { product, sale });
}
