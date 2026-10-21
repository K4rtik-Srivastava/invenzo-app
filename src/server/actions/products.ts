"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { defineAction } from "@/server/action";
import { adjustStock, createProduct, createUnit, deleteProduct, deleteUnit, setArchived, updateProduct } from "@/server/products";
import {
  adjustStockSchema,
  createProductSchema,
  productIdSchema,
  unitIdSchema,
  unitSchema,
  updateProductSchema,
} from "@/lib/validation/products";
import { formatQty } from "@/lib/format";
import { importProducts } from "@/server/import";
import { importSchema } from "@/lib/validation/import";

export const createProductAction = defineAction(
  { permission: "product.manage", schema: createProductSchema },
  async (input, actor) => {
    const product = await createProduct(actor, input);
    redirect(`/inventory/${product.id}?created=1`);
  },
);

export const updateProductAction = defineAction(
  { permission: "product.manage", schema: updateProductSchema },
  async ({ productId, ...input }, actor) => {
    await updateProduct(actor, productId, input);
    redirect(`/inventory/${productId}?saved=1`);
  },
);

export const adjustStockAction = defineAction(
  { permission: "product.manage", schema: adjustStockSchema },
  async (input, actor) => {
    const product = await adjustStock(actor, input);
    refresh();
    return { ok: true, message: `Stock updated. ${product.name} now has ${formatQty(product.currentStock, product.unit.name)}.` };
  },
);

export const archiveProductAction = defineAction(
  { permission: "product.manage", schema: productIdSchema },
  async ({ productId }, actor) => {
    const product = await setArchived(actor, productId, true);
    refresh();
    return { ok: true, message: `${product.name} archived. It's hidden from the list and can't be sold.` };
  },
);

export const restoreProductAction = defineAction(
  { permission: "product.manage", schema: productIdSchema },
  async ({ productId }, actor) => {
    const product = await setArchived(actor, productId, false);
    refresh();
    return { ok: true, message: `${product.name} restored.` };
  },
);

export const deleteProductAction = defineAction(
  { permission: "product.manage", schema: productIdSchema },
  async ({ productId }, actor) => {
    await deleteProduct(actor, productId);
    redirect("/inventory?deleted=1");
  },
);

export const createUnitAction = defineAction(
  { permission: "product.manage", schema: unitSchema },
  async ({ name }, actor) => {
    const unit = await createUnit(actor, name);
    refresh();
    return { ok: true, message: `Unit "${unit.name}" added.`, data: { id: unit.id, name: unit.name } };
  },
);

export const deleteUnitAction = defineAction(
  { permission: "product.manage", schema: unitIdSchema },
  async ({ unitId }, actor) => {
    await deleteUnit(actor, unitId);
    refresh();
    return { ok: true, message: "Unit removed." };
  },
);

export const importProductsAction = defineAction(
  { permission: "product.import", schema: importSchema },
  async ({ rows, createMissingUnits, dryRun }, actor) => {
    const summary = await importProducts(actor, rows, { createMissingUnits, dryRun });
    if (!dryRun) refresh();
    return { ok: true, data: summary, message: dryRun ? undefined : `Imported ${summary.imported} products.` };
  },
);
