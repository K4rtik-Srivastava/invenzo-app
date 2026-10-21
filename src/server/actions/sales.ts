"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { defineAction } from "@/server/action";
import { cancelSale, createSale, updateSale } from "@/server/sales";
import { cancelSaleSchema, createSaleSchema, updateSaleSchema } from "@/lib/validation/sales";

export const createSaleAction = defineAction({ permission: "sale.create", schema: createSaleSchema }, async (input, actor) => {
  const sale = await createSale(actor, input);
  redirect(`/sales/${sale.id}?created=1`);
});

export const updateSaleAction = defineAction({ permission: "sale.manage", schema: updateSaleSchema }, async ({ saleId, ...input }, actor) => {
  await updateSale(actor, saleId, input);
  redirect(`/sales/${saleId}?saved=1`);
});

export const cancelSaleAction = defineAction({ permission: "sale.manage", schema: cancelSaleSchema }, async ({ saleId, reason }, actor) => {
  const sale = await cancelSale(actor, saleId, reason);
  refresh();
  return { ok: true, message: `Invoice ${sale.invoiceNumber} cancelled. All its stock has been put back.` };
});
