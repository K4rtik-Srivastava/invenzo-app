import { z } from "zod";
import type { ImportKey } from "@/lib/import-columns";

export const MAX_IMPORT_ROWS = 5000;

export type ImportRow = Partial<Record<ImportKey, string>>;

export const importSchema = z.object({
  rows: z
    .array(z.record(z.string(), z.string().max(5000)))
    .min(1, "The file has no product rows.")
    .max(MAX_IMPORT_ROWS, `Import up to ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} products at a time. Split the file and import it in parts.`),
  createMissingUnits: z.boolean().default(false),
  dryRun: z.boolean().default(true),
});

/** "₹1,200.50" → "1200.50", "18%" → "18", " 12 " → "12". Leaves anything else for the validator to reject. */
export function cleanNumber(value: string | undefined) {
  if (value === undefined) return undefined;
  const cleaned = value.replace(/[₹,\s%]/g, "").replace(/^rs\.?/i, "");
  return cleaned === "" ? undefined : cleaned;
}
