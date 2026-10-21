import { z } from "zod";

// Form values arrive as text. Empty optional fields become null; numbers stay
// as exact decimal strings (never floating point) until they reach the database.

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .transform((v) => (v ? v : null));

const decimal = (places: number, message: string) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{1,11}(\\.\\d{1,${places}})?$`), message);

export const quantity = decimal(3, "Enter a number (up to 3 decimals), e.g. 12 or 2.5.");

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(decimal(2, "Enter an amount, e.g. 120 or 99.50.").nullable());

const optionalPercent = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(
    decimal(2, "Enter a percentage, e.g. 18.")
      .refine((v) => Number(v) <= 100, "GST can't be more than 100%.")
      .nullable(),
  );

export const productFields = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(200, "Keep the name under 200 characters."),
  brand: optionalText(100, "Brand"),
  hsnCode: optionalText(8, "HSN code").refine((v) => v === null || /^\d{2,8}$/.test(v), "HSN codes are 2 to 8 digits."),
  sku: optionalText(64, "SKU"),
  description: optionalText(5000, "Description"),
  unitId: z.string().min(1, "Choose a unit."),
  purchasePrice: optionalMoney,
  sellingPrice: optionalMoney,
  gstRate: optionalPercent,
  reorderLevel: quantity.default("0"),
});

export const createProductSchema = productFields.extend({ openingStock: quantity.default("0") });
export const updateProductSchema = productFields.extend({ productId: z.string().min(1) });

export type ProductInput = z.output<typeof productFields>;
export type CreateProductInput = z.output<typeof createProductSchema>;

export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  quantity: quantity.refine((v) => Number(v) > 0, "Enter a quantity greater than zero."),
  note: z.string().trim().min(1, "Add a short reason, e.g. “New delivery” or “Damaged”.").max(300),
});
export type AdjustStockInput = z.output<typeof adjustStockSchema>;

export const productIdSchema = z.object({ productId: z.string().min(1) });

export const unitSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a unit name.")
    .max(20, "Keep unit names short (20 characters).")
    .regex(/^[\p{L}\p{N} .\-/]+$/u, "Use letters, numbers, spaces, dots, dashes or slashes."),
});
export const unitIdSchema = z.object({ unitId: z.string().min(1) });
