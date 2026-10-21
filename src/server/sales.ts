import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { applyStockChange } from "@/server/stock";
import { isUniqueViolation } from "@/server/users";
import { formatQty } from "@/lib/format";
import { invoiceKey, type SaleInput } from "@/lib/validation/sales";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; name: string };
type Options = { requestId?: string | null };

const INVOICE_LOCK = 7_301_003;

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function duplicateInvoiceError(invoiceNumber: string) {
  const existing = await db.sale.findUnique({ where: { invoiceKey: invoiceKey(invoiceNumber) }, select: { id: true, invoiceNumber: true } });
  return new AppError(
    `Invoice ${existing?.invoiceNumber ?? invoiceNumber} is already recorded. Open it to check or change it.`,
    { invoiceNumber: ["This invoice number is already recorded."] },
    existing ? { existingSaleId: existing.id } : undefined,
  );
}

/**
 * Checks an invoice number is free: not on another sale, and not on an
 * Employee's sale that is still waiting for approval. Holds a lock on the
 * number until the transaction ends, so two people can't claim it at once.
 */
export async function checkInvoiceFree(tx: Tx, invoiceNumber: string) {
  const key = invoiceKey(invoiceNumber);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${INVOICE_LOCK}::int, hashtext(${key}::text))`;
  if (await tx.sale.findUnique({ where: { invoiceKey: key }, select: { id: true } })) throw await duplicateInvoiceError(invoiceNumber);
  const waiting = await tx.changeRequest.findFirst({
    where: { action: "CREATE_SALE", status: "PENDING", payload: { path: ["invoiceKey"], equals: key } },
    select: { id: true, requestedBy: { select: { name: true } } },
  });
  if (waiting) {
    throw new AppError(
      `Invoice ${invoiceNumber} was already sent for approval by ${waiting.requestedBy.name}.`,
      { invoiceNumber: ["This invoice is waiting for an Admin's approval."] },
      { pendingRequestId: waiting.id },
    );
  }
}

/** Loads the products on a sale and checks they can be sold. */
async function loadProducts(tx: Tx, productIds: string[]) {
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, isArchived: true, unit: { select: { name: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const id of productIds) if (!byId.has(id)) throw new AppError("One of the products no longer exists. Please remove it and try again.");
  return byId;
}

/**
 * Locks a sale row until the transaction ends, so an edit and a cancel (or
 * two edits) of the same sale can't run at the same time.
 */
async function lockSale(tx: Tx, saleId: string) {
  await tx.$queryRaw`SELECT id FROM sale WHERE id = ${saleId} FOR UPDATE`;
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    include: { items: { include: { product: { select: { name: true, isArchived: true, unit: { select: { name: true } } } } } } },
  });
  if (!sale) throw new AppError("That sale no longer exists.");
  return sale;
}

// ─── Record a sale ──────────────────────────────────────────────────────────

export async function createSaleTx(tx: Tx, actor: Actor, input: SaleInput, options: Options & { enteredBy?: Actor } = {}) {
  const products = await loadProducts(tx, input.items.map((i) => i.productId));
  for (const item of input.items) {
    const product = products.get(item.productId)!;
    if (product.isArchived) throw new AppError(`${product.name} is archived and can't be sold.`);
  }

  // Claiming the invoice number first means a duplicate fails fast, before any stock moves.
  const sale = await tx.sale.create({
    data: {
      invoiceNumber: input.invoiceNumber,
      invoiceKey: invoiceKey(input.invoiceNumber),
      date: toDate(input.date),
      customerName: input.customerName,
      note: input.note,
      // An approved Employee sale is shown as theirs; the stock history shows the approving Admin.
      createdById: options.enteredBy?.id ?? actor.id,
      items: { create: input.items.map((i) => ({ productId: i.productId, quantity: new Prisma.Decimal(i.quantity) })) },
    },
    select: { id: true, invoiceNumber: true },
  });

  // Always touch products in the same (id) order, so two sales with the same
  // products in a different order can't deadlock each other.
  const lines = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId));
  for (const line of lines) {
    await applyStockChange(tx, {
      productId: line.productId,
      delta: new Prisma.Decimal(line.quantity).negated(),
      type: "SALE",
      actorId: actor.id,
      saleId: sale.id,
      requestId: options.requestId,
      note: `Invoice ${sale.invoiceNumber}`,
    });
  }

  await audit(tx, {
    actorId: actor.id,
    action: "sale.create",
    entityType: "sale",
    entityId: sale.id,
    summary: `${actor.name} recorded invoice ${sale.invoiceNumber}${options.enteredBy ? ` (entered by ${options.enteredBy.name})` : ""}: ${input.items
      .map((i) => `${formatQty(i.quantity, products.get(i.productId)!.unit.name)} ${products.get(i.productId)!.name}`)
      .join(", ")}`,
    after: input,
  });
  return sale;
}

export async function createSale(actor: Actor, input: SaleInput) {
  try {
    return await db.$transaction(async (tx) => {
      await checkInvoiceFree(tx, input.invoiceNumber);
      return createSaleTx(tx, actor, input);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw await duplicateInvoiceError(input.invoiceNumber);
    throw error;
  }
}

// ─── Edit a sale (Admins) ───────────────────────────────────────────────────

export async function updateSaleTx(tx: Tx, actor: Actor, saleId: string, input: SaleInput, options: Options = {}) {
  const before = await lockSale(tx, saleId);
  if (before.status !== "ACTIVE") throw new AppError("This sale has been cancelled and can't be edited.");

  const oldQty = new Map(before.items.map((i) => [i.productId, i.quantity]));
  const newQty = new Map(input.items.map((i) => [i.productId, new Prisma.Decimal(i.quantity)]));
  const allIds = [...new Set([...oldQty.keys(), ...newQty.keys()])].sort();
  const products = await loadProducts(tx, allIds);
  const zero = new Prisma.Decimal(0);

  await tx.sale.update({
    where: { id: saleId },
    data: {
      invoiceNumber: input.invoiceNumber,
      invoiceKey: invoiceKey(input.invoiceNumber),
      date: toDate(input.date),
      customerName: input.customerName,
      note: input.note,
    },
  });

  const changes: string[] = [];
  for (const productId of allIds) {
    const was = oldQty.get(productId) ?? zero;
    const now = newQty.get(productId) ?? zero;
    if (was.equals(now)) continue;
    const product = products.get(productId)!;
    if (now.greaterThan(was) && product.isArchived) {
      throw new AppError(`${product.name} is archived, so you can't sell more of it. You can still reduce or remove it.`);
    }
    // Selling more takes stock; selling less (or removing the line) gives it back.
    const delta = was.minus(now);
    await applyStockChange(tx, {
      productId,
      delta,
      type: delta.isNegative() ? "SALE" : "SALE_REVERSAL",
      actorId: actor.id,
      saleId,
      requestId: options.requestId,
      note: `Invoice ${input.invoiceNumber} edited: ${formatQty(was, product.unit.name)} → ${formatQty(now, product.unit.name)}`,
    });
    changes.push(`${product.name} ${formatQty(was)} → ${formatQty(now, product.unit.name)}`);
  }

  await tx.saleItem.deleteMany({ where: { saleId } });
  await tx.saleItem.createMany({ data: input.items.map((i) => ({ saleId, productId: i.productId, quantity: new Prisma.Decimal(i.quantity) })) });

  if (before.invoiceNumber !== input.invoiceNumber) changes.unshift(`invoice number ${before.invoiceNumber} → ${input.invoiceNumber}`);
  await audit(tx, {
    actorId: actor.id,
    action: "sale.update",
    entityType: "sale",
    entityId: saleId,
    summary: `${actor.name} edited invoice ${input.invoiceNumber}${changes.length ? `: ${changes.join(", ")}` : " (details only)"}`,
    before: {
      invoiceNumber: before.invoiceNumber,
      date: before.date,
      customerName: before.customerName,
      note: before.note,
      items: before.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    },
    after: input,
  });
  return { id: saleId, invoiceNumber: input.invoiceNumber };
}

export async function updateSale(actor: Actor, saleId: string, input: SaleInput) {
  try {
    return await db.$transaction((tx) => updateSaleTx(tx, actor, saleId, input));
  } catch (error) {
    if (isUniqueViolation(error)) throw await duplicateInvoiceError(input.invoiceNumber);
    throw error;
  }
}

// ─── Cancel a sale (Admins) ─────────────────────────────────────────────────

export async function cancelSaleTx(tx: Tx, actor: Actor, saleId: string, reason: string, options: Options = {}) {
  const sale = await lockSale(tx, saleId);
  if (sale.status === "CANCELLED") throw new AppError("This sale is already cancelled.");

  for (const item of [...sale.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
    await applyStockChange(tx, {
      productId: item.productId,
      delta: item.quantity,
      type: "SALE_REVERSAL",
      actorId: actor.id,
      saleId,
      requestId: options.requestId,
      note: `Invoice ${sale.invoiceNumber} cancelled: ${reason}`,
    });
  }
  // Clearing the key frees the invoice number so it can be entered again correctly.
  await tx.sale.update({
    where: { id: saleId },
    data: { status: "CANCELLED", invoiceKey: null, cancelReason: reason, cancelledAt: new Date() },
  });
  await audit(tx, {
    actorId: actor.id,
    action: "sale.cancel",
    entityType: "sale",
    entityId: saleId,
    summary: `${actor.name} cancelled invoice ${sale.invoiceNumber} (${reason}); stock returned for ${sale.items.length} product${
      sale.items.length === 1 ? "" : "s"
    }`,
  });
  return { id: saleId, invoiceNumber: sale.invoiceNumber };
}

export function cancelSale(actor: Actor, saleId: string, reason: string) {
  return db.$transaction((tx) => cancelSaleTx(tx, actor, saleId, reason));
}
