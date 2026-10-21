import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { isUniqueViolation } from "@/server/users";
import { createProductSchema } from "@/lib/validation/products";
import { cleanNumber, type ImportRow } from "@/lib/validation/import";

type Actor = { id: string; name: string };

export type ImportProblem = { line: number; name: string; messages: string[] };
export type ImportSummary = {
  total: number;
  valid: number;
  problems: ImportProblem[]; // first 200
  problemCount: number;
  newUnits: string[];
  imported?: number;
};

const unitKey = (name: string) => name.trim().toLowerCase();

/**
 * Checks every row of an import file and, unless `dryRun`, adds all the
 * products in one transaction (with their opening stock in the ledger).
 * Nothing is imported while any row has a problem.
 */
export async function importProducts(actor: Actor, rows: ImportRow[], options: { createMissingUnits: boolean; dryRun: boolean }): Promise<ImportSummary> {
  const units = new Map((await db.unit.findMany({ select: { id: true, name: true } })).map((u) => [unitKey(u.name), u.id]));
  const skus = rows.map((r) => r.sku?.trim()).filter((s): s is string => Boolean(s));
  const existingSkus = new Set(
    skus.length
      ? (await db.$queryRaw<{ sku: string }[]>`SELECT lower(sku) AS sku FROM product WHERE lower(sku) = ANY(${skus.map((s) => s.toLowerCase())})`).map((r) => r.sku)
      : [],
  );

  const seenSkus = new Map<string, number>();
  const newUnits = new Set<string>();
  const problems: ImportProblem[] = [];
  const valid: { input: ReturnType<typeof createProductSchema.parse>; unitName: string }[] = [];

  rows.forEach((row, index) => {
    const line = index + 2; // +1 for the header row, +1 because spreadsheets count from 1
    const messages: string[] = [];
    const unitName = (row.unit ?? "").trim();

    if (!unitName) messages.push("Unit is missing.");
    else if (!units.has(unitKey(unitName))) {
      if (options.createMissingUnits && /^[\p{L}\p{N} .\-/]{1,20}$/u.test(unitName)) newUnits.add(unitKey(unitName));
      else messages.push(`Unit “${unitName}” doesn't exist. Add it under Inventory → Units, or tick “Create missing units”.`);
    }

    const sku = row.sku?.trim();
    if (sku) {
      const key = sku.toLowerCase();
      if (existingSkus.has(key)) messages.push(`SKU “${sku}” is already used by a product.`);
      else if (seenSkus.has(key)) messages.push(`SKU “${sku}” also appears on line ${seenSkus.get(key)}.`);
      else seenSkus.set(key, line);
    }

    const parsed = createProductSchema.safeParse({
      name: row.name ?? "",
      brand: row.brand ?? "",
      sku: sku ?? "",
      hsnCode: (row.hsnCode ?? "").replace(/\s/g, ""),
      description: row.description ?? "",
      unitId: "pending", // resolved below
      openingStock: cleanNumber(row.openingStock) ?? "0",
      reorderLevel: cleanNumber(row.reorderLevel) ?? "0",
      purchasePrice: cleanNumber(row.purchasePrice) ?? "",
      sellingPrice: cleanNumber(row.sellingPrice) ?? "",
      gstRate: cleanNumber(row.gstRate) ?? "",
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "");
        const label = { name: "Name", openingStock: "Opening stock", reorderLevel: "Low-stock level", hsnCode: "HSN code", sellingPrice: "Selling price", purchasePrice: "Purchase price", gstRate: "GST", sku: "SKU", brand: "Brand", description: "Description" }[field] ?? field;
        messages.push(`${label}: ${issue.message}`);
      }
    }

    if (messages.length > 0) problems.push({ line, name: (row.name ?? "").trim() || "(no name)", messages });
    else if (parsed.success) valid.push({ input: parsed.data, unitName: unitKey(unitName) });
  });

  const summary: ImportSummary = {
    total: rows.length,
    valid: valid.length,
    problems: problems.slice(0, 200),
    problemCount: problems.length,
    newUnits: [...newUnits],
  };
  if (options.dryRun) return summary;
  if (problems.length > 0) throw new AppError(`${problems.length} row${problems.length === 1 ? " has" : "s have"} problems. Fix them and upload the file again.`);

  try {
    await db.$transaction(async (tx) => {
      for (const name of newUnits) {
        const unit = await tx.unit.create({ data: { name, isCustom: true } });
        units.set(name, unit.id);
      }
      const products = valid.map(({ input, unitName }) => {
        const opening = new Prisma.Decimal(input.openingStock);
        return {
          id: randomUUID(),
          name: input.name,
          brand: input.brand,
          sku: input.sku,
          hsnCode: input.hsnCode,
          description: input.description,
          unitId: units.get(unitName)!,
          purchasePrice: input.purchasePrice === null ? null : new Prisma.Decimal(input.purchasePrice),
          sellingPrice: input.sellingPrice === null ? null : new Prisma.Decimal(input.sellingPrice),
          gstRate: input.gstRate === null ? null : new Prisma.Decimal(input.gstRate),
          reorderLevel: new Prisma.Decimal(input.reorderLevel),
          openingStock: opening,
          currentStock: opening,
        };
      });
      for (let i = 0; i < products.length; i += 1000) await tx.product.createMany({ data: products.slice(i, i + 1000) });
      const openings = products
        .filter((p) => !p.openingStock.isZero())
        .map((p) => ({ productId: p.id, type: "OPENING" as const, quantity: p.openingStock, balanceAfter: p.openingStock, note: "Opening stock (imported)", createdById: actor.id }));
      for (let i = 0; i < openings.length; i += 1000) await tx.stockMovement.createMany({ data: openings.slice(i, i + 1000) });
      await audit(tx, {
        actorId: actor.id,
        action: "product.import",
        entityType: "product",
        summary: `${actor.name} imported ${products.length} product${products.length === 1 ? "" : "s"} from a file${newUnits.size ? ` (new units: ${[...newUnits].join(", ")})` : ""}`,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("Another product with one of these SKUs was added while you were importing. Upload the file again to re-check.");
    throw error;
  }
  return { ...summary, imported: valid.length };
}
