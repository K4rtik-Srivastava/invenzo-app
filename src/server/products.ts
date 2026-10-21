import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { applyStockChange } from "@/server/stock";
import { isUniqueViolation } from "@/server/users";
import { formatQty } from "@/lib/format";
import type { AdjustStockInput, CreateProductInput, ProductInput } from "@/lib/validation/products";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; name: string };
type Options = { requestId?: string | null };

const dec = (v: string | null) => (v === null ? null : new Prisma.Decimal(v));

const skuTaken = () => new AppError("Another product already uses this SKU.", { sku: ["This SKU is already in use."] });

function productData(input: ProductInput) {
  return {
    name: input.name,
    brand: input.brand,
    hsnCode: input.hsnCode,
    sku: input.sku,
    description: input.description,
    unitId: input.unitId,
    purchasePrice: dec(input.purchasePrice),
    sellingPrice: dec(input.sellingPrice),
    gstRate: dec(input.gstRate),
    reorderLevel: new Prisma.Decimal(input.reorderLevel),
  };
}

async function assertUnit(tx: Tx, unitId: string) {
  const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { name: true } });
  if (!unit) throw new AppError("That unit no longer exists.", { unitId: ["Choose a unit."] });
  return unit;
}

// ─── Transaction-level operations (reused when approving employee requests) ──

export async function createProductTx(tx: Tx, actor: Actor, input: CreateProductInput, options: Options = {}) {
  const unit = await assertUnit(tx, input.unitId);
  const opening = new Prisma.Decimal(input.openingStock);
  const product = await tx.product.create({
    data: { ...productData(input), openingStock: opening, currentStock: 0 },
    select: { id: true, name: true },
  });
  if (!opening.isZero()) {
    await applyStockChange(tx, {
      productId: product.id,
      delta: opening,
      type: "OPENING",
      actorId: actor.id,
      requestId: options.requestId,
      note: "Opening stock",
    });
  }
  await audit(tx, {
    actorId: actor.id,
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    summary: `${actor.name} added ${product.name} with opening stock ${formatQty(opening, unit.name)}`,
    after: { ...input },
  });
  return product;
}

const FIELD_LABELS: Record<keyof ProductInput, string> = {
  name: "name",
  brand: "brand",
  hsnCode: "HSN code",
  sku: "SKU",
  description: "description",
  unitId: "unit",
  purchasePrice: "purchase price",
  sellingPrice: "selling price",
  gstRate: "GST rate",
  reorderLevel: "low-stock level",
};

export async function updateProductTx(tx: Tx, actor: Actor, productId: string, input: ProductInput) {
  const before = await tx.product.findUnique({ where: { id: productId } });
  if (!before) throw new AppError("That product no longer exists.");
  await assertUnit(tx, input.unitId);
  const data = productData(input);
  const after = await tx.product.update({ where: { id: productId }, data });

  const changed = (Object.keys(FIELD_LABELS) as (keyof ProductInput)[]).filter(
    (key) => String(before[key] ?? "") !== String(after[key] ?? ""),
  );
  if (changed.length > 0) {
    await audit(tx, {
      actorId: actor.id,
      action: "product.update",
      entityType: "product",
      entityId: productId,
      summary: `${actor.name} edited ${after.name}: ${changed.map((k) => FIELD_LABELS[k]).join(", ")}`,
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, after[k]])),
    });
  }
  return after;
}

export async function adjustStockTx(tx: Tx, actor: Actor, input: AdjustStockInput, options: Options = {}) {
  const product = await tx.product.findUnique({ where: { id: input.productId }, select: { isArchived: true, name: true } });
  if (!product) throw new AppError("That product no longer exists.");
  if (product.isArchived) throw new AppError(`${product.name} is archived. Restore it before changing its stock.`);
  const qty = new Prisma.Decimal(input.quantity);
  const result = await applyStockChange(tx, {
    productId: input.productId,
    delta: input.direction === "IN" ? qty : qty.negated(),
    type: input.direction === "IN" ? "STOCK_IN" : "STOCK_OUT",
    actorId: actor.id,
    requestId: options.requestId,
    note: input.note,
  });
  await audit(tx, {
    actorId: actor.id,
    action: input.direction === "IN" ? "stock.in" : "stock.out",
    entityType: "product",
    entityId: input.productId,
    summary: `${actor.name} ${input.direction === "IN" ? "added" : "removed"} ${formatQty(qty, result.unit.name)} ${
      input.direction === "IN" ? "to" : "from"
    } ${result.name} (${input.note}). New stock: ${formatQty(result.currentStock, result.unit.name)}`,
  });
  return result;
}

// ─── Public operations (each runs in its own transaction) ───────────────────

export async function createProduct(actor: Actor, input: CreateProductInput) {
  try {
    return await db.$transaction((tx) => createProductTx(tx, actor, input));
  } catch (error) {
    if (isUniqueViolation(error)) throw skuTaken();
    throw error;
  }
}

export async function updateProduct(actor: Actor, productId: string, input: ProductInput) {
  try {
    return await db.$transaction((tx) => updateProductTx(tx, actor, productId, input));
  } catch (error) {
    if (isUniqueViolation(error)) throw skuTaken();
    throw error;
  }
}

export function adjustStock(actor: Actor, input: AdjustStockInput) {
  return db.$transaction((tx) => adjustStockTx(tx, actor, input));
}

export function setArchived(actor: Actor, productId: string, isArchived: boolean) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id: productId }, data: { isArchived }, select: { id: true, name: true } });
    await audit(tx, {
      actorId: actor.id,
      action: isArchived ? "product.archive" : "product.restore",
      entityType: "product",
      entityId: productId,
      summary: `${actor.name} ${isArchived ? "archived" : "restored"} ${product.name}`,
    });
    return product;
  });
}

/**
 * Deletes a product for good, but only if nothing refers to it: no sales,
 * no requests and no stock movements other than its opening stock.
 * Products with history should be archived instead, so records stay intact.
 */
export async function deleteProduct(actor: Actor, productId: string) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        sku: true,
        _count: { select: { saleItems: true, requests: true, movements: { where: { type: { not: "OPENING" } } } } },
      },
    });
    if (!product) throw new AppError("That product no longer exists.");
    const { saleItems, requests, movements } = product._count;
    if (saleItems + requests + movements > 0) {
      throw new AppError(`${product.name} has sales or stock history, so it can't be deleted. Archive it instead.`);
    }
    await tx.product.delete({ where: { id: productId } });
    await audit(tx, {
      actorId: actor.id,
      action: "product.delete",
      entityType: "product",
      entityId: productId,
      summary: `${actor.name} deleted ${product.name}${product.sku ? ` (${product.sku})` : ""}`,
    });
  });
}

// ─── Units ──────────────────────────────────────────────────────────────────

export async function createUnit(actor: Actor, name: string) {
  try {
    return await db.$transaction(async (tx) => {
      const unit = await tx.unit.create({ data: { name, isCustom: true } });
      await audit(tx, { actorId: actor.id, action: "unit.create", entityType: "unit", entityId: unit.id, summary: `${actor.name} added unit "${name}"` });
      return unit;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(`The unit "${name}" already exists.`, { name: ["This unit already exists."] });
    throw error;
  }
}

export async function deleteUnit(actor: Actor, unitId: string) {
  return db.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({ where: { id: unitId }, include: { _count: { select: { products: true } } } });
    if (!unit) throw new AppError("That unit no longer exists.");
    if (unit._count.products > 0) throw new AppError(`"${unit.name}" is used by ${unit._count.products} product(s), so it can't be removed.`);
    await tx.unit.delete({ where: { id: unitId } });
    await audit(tx, { actorId: actor.id, action: "unit.delete", entityType: "unit", entityId: unitId, summary: `${actor.name} removed unit "${unit.name}"` });
  });
}
