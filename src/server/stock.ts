import { Prisma, type MovementType } from "@/generated/prisma/client";
import { AppError } from "@/server/errors";
import { formatQty } from "@/lib/format";

type Tx = Prisma.TransactionClient;

export type StockChange = {
  productId: string;
  delta: Prisma.Decimal; // + adds stock, − removes stock
  type: MovementType;
  actorId: string;
  saleId?: string | null;
  requestId?: string | null;
  note?: string | null;
};

/**
 * The ONLY place stock levels change. Must be called inside a transaction.
 *
 * It updates the running total and writes the ledger row together. Removing
 * stock uses a single conditional UPDATE ("…WHERE currentStock >= qty"), so
 * when two people sell the last few items at the same moment, the database
 * lets exactly one of them through and the other gets a clear error. Stock
 * can never go below zero (the database also has a CHECK constraint).
 */
export async function applyStockChange(tx: Tx, change: StockChange) {
  if (change.delta.isZero()) throw new Error("applyStockChange called with zero quantity");
  const removing = change.delta.isNegative();

  let product;
  try {
    product = await tx.product.update({
      where: removing ? { id: change.productId, currentStock: { gte: change.delta.negated() } } : { id: change.productId },
      data: { currentStock: { increment: change.delta } },
      select: { id: true, name: true, currentStock: true, unit: { select: { name: true } } },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      const current = await tx.product.findUnique({
        where: { id: change.productId },
        select: { name: true, currentStock: true, unit: { select: { name: true } } },
      });
      if (!current) throw new AppError("That product no longer exists.");
      throw new AppError(
        `Not enough stock for ${current.name}: only ${formatQty(current.currentStock, current.unit.name)} available, ` +
          `${formatQty(change.delta.negated(), current.unit.name)} needed.`,
      );
    }
    throw error;
  }

  await tx.stockMovement.create({
    data: {
      productId: change.productId,
      type: change.type,
      quantity: change.delta,
      balanceAfter: product.currentStock,
      saleId: change.saleId ?? null,
      requestId: change.requestId ?? null,
      note: change.note ?? null,
      createdById: change.actorId,
    },
  });

  return product;
}
