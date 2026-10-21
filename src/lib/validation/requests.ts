import { z } from "zod";
import { saleFields } from "@/lib/validation/sales";

const reason = z.string().trim().min(3, "Briefly explain why this change is needed.").max(500, "Keep the reason under 500 characters.");
const id = z.string().min(1);

// What an Employee can send to an Admin. The same rules as the direct Admin
// actions apply, and everything is checked again when an Admin approves.
export const submitRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_SALE"), sale: saleFields }),
  z.object({ action: z.literal("UPDATE_SALE"), reason, saleId: id, sale: saleFields }),
  z.object({ action: z.literal("CANCEL_SALE"), reason, saleId: id }),
]);
export type SubmitRequestInput = z.output<typeof submitRequestSchema>;

export const reviewRequestSchema = z.object({
  requestId: id,
  note: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
});
export const rejectRequestSchema = reviewRequestSchema.extend({
  note: z.string().trim().min(3, "Tell the employee why it was rejected.").max(500),
});

// ─── Stored payloads (what's saved in ChangeRequest.payload) ────────────────

export type RequestPayload =
  | { action: "CREATE_SALE"; sale: z.output<typeof saleFields>; invoiceKey: string }
  | { action: "UPDATE_SALE"; sale: z.output<typeof saleFields>; original: z.output<typeof saleFields>; saleUpdatedAt: string }
  | { action: "CANCEL_SALE" }
  // Product and stock requests from before only Admins could change inventory.
  | { action: "CREATE_PRODUCT" | "UPDATE_PRODUCT" | "ADJUST_STOCK" };

export const REQUEST_STATUS_FILTERS = ["pending", "approved", "rejected", "all"] as const;
