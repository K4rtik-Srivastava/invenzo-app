import { z } from "zod";
import { todayISO } from "@/lib/format";
import { quantity } from "@/lib/validation/products";

/** "  gst/ 245 " and "GST/245" are the same invoice. */
export function invoiceKey(invoiceNumber: string) {
  return invoiceNumber.trim().replace(/\s+/g, "").toUpperCase();
}

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), "Choose a valid date.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : null));

export const saleLineSchema = z.object({
  productId: z.string().min(1, "Choose a product."),
  quantity: quantity.refine((v) => Number(v) > 0, "Enter a quantity greater than zero."),
});

export const saleFields = z.object({
  invoiceNumber: z
    .string()
    .trim()
    .min(1, "Enter the invoice number from your bill.")
    .max(50, "Invoice numbers can be up to 50 characters.")
    .regex(/^[\p{L}\p{N} ./\-_#]+$/u, "Use letters, numbers, spaces and . / - _ #"),
  date: isoDate.refine((v) => v <= todayISO(), "The sale date can't be in the future."),
  customerName: optionalText(100),
  note: optionalText(500),
  items: z
    .array(saleLineSchema)
    .min(1, "Add at least one product.")
    .max(100, "A sale can have up to 100 products.")
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, "Each product can only appear once. Combine the quantities."),
});

export const createSaleSchema = saleFields;
export const updateSaleSchema = saleFields.extend({ saleId: z.string().min(1) });
export const cancelSaleSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(1, "Say why the sale is being cancelled.").max(300),
});

export type SaleInput = z.output<typeof saleFields>;

// ─── Sales list filters (from the address bar) ──────────────────────────────

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const optionalDate = z.preprocess(first, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined));

export const saleSearchSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(100).optional().catch(undefined).transform((v) => v || undefined)),
  from: optionalDate,
  to: optionalDate,
  status: z.preprocess(first, z.enum(["active", "cancelled", "all"]).catch("active").default("active")),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1).default(1)),
});
export type SaleSearch = z.output<typeof saleSearchSchema>;
