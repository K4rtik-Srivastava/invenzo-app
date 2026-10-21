import { z } from "zod";

// Turns the address-bar parameters of the Inventory page into clean filters.
// Anything unknown or malformed falls back to a safe default instead of erroring.

export const STOCK_FILTERS = ["in", "low", "out"] as const;
export const PRODUCT_SORTS = ["name", "-name", "stock", "-stock", "price", "-price"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const SORT_LABELS: Record<ProductSort, string> = {
  name: "Name A–Z",
  "-name": "Name Z–A",
  stock: "Stock: low to high",
  "-stock": "Stock: high to low",
  price: "Price: low to high",
  "-price": "Price: high to low",
};

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const text = (max: number) =>
  z.preprocess(
    first,
    z
      .string()
      .trim()
      .max(max)
      .optional()
      .catch(undefined)
      .transform((v) => v || undefined),
  );

export const productSearchSchema = z.object({
  q: text(100),
  brand: text(100),
  unit: text(40),
  stock: z.preprocess(first, z.enum(STOCK_FILTERS).optional().catch(undefined)),
  sort: z.preprocess(first, z.enum(PRODUCT_SORTS).catch("name").default("name")),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1).default(1)),
  archived: z.preprocess(first, z.literal("1").optional().catch(undefined)),
});

export type ProductSearch = z.output<typeof productSearchSchema>;

export function parseProductSearch(params: Record<string, string | string[] | undefined>): ProductSearch {
  return productSearchSchema.parse(params);
}

/** Splits a search into words: "led  9w " → ["led", "9w"]. */
export function searchTerms(q: string | undefined) {
  return (q ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
}
