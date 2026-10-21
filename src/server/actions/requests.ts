"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { defineAction } from "@/server/action";
import { approveRequest, rejectRequest, submitRequest } from "@/server/requests";
import { rejectRequestSchema, reviewRequestSchema, submitRequestSchema } from "@/lib/validation/requests";

export const submitRequestAction = defineAction({ permission: "request.create", schema: submitRequestSchema }, async (input, actor) => {
  const request = await submitRequest(actor, input);
  redirect(`/requests/${request.id}?submitted=1`);
});

export const approveRequestAction = defineAction({ permission: "request.review", schema: reviewRequestSchema }, async ({ requestId, note }, admin) => {
  await approveRequest(admin, requestId, note);
  refresh();
  return { ok: true, message: "Approved. The change has been applied." };
});

export const rejectRequestAction = defineAction({ permission: "request.review", schema: rejectRequestSchema }, async ({ requestId, note }, admin) => {
  await rejectRequest(admin, requestId, note);
  refresh();
  return { ok: true, message: "Rejected. Nothing was changed." };
});
