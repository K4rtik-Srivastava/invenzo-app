// Columns of the product import file. Header names are matched loosely
// ("HSN Code", "hsn_code" and "hsn" all work).
export const IMPORT_COLUMNS = [
  { key: "name", header: "name", aliases: ["product", "product name", "item", "item name"], required: true, example: "LED Bulb 9W" },
  { key: "brand", header: "brand", aliases: ["manufacturer", "make", "company"], example: "Philips" },
  { key: "sku", header: "sku", aliases: ["item code", "code", "product code"], example: "PH-LED-9W" },
  { key: "hsnCode", header: "hsn_code", aliases: ["hsn", "hsn code", "hsn/sac"], example: "8539" },
  { key: "unit", header: "unit", aliases: ["uom", "unit of measurement", "units"], required: true, example: "pcs" },
  { key: "openingStock", header: "opening_stock", aliases: ["stock", "quantity", "qty", "opening stock", "current stock"], example: "120" },
  { key: "reorderLevel", header: "low_stock_level", aliases: ["reorder level", "low stock level", "reorder", "min stock"], example: "20" },
  { key: "purchasePrice", header: "purchase_price", aliases: ["cost", "cost price", "purchase price"], example: "62" },
  { key: "sellingPrice", header: "selling_price", aliases: ["price", "mrp", "sale price", "selling price", "rate"], example: "95" },
  { key: "gstRate", header: "gst_rate", aliases: ["gst", "gst %", "tax", "gst rate"], example: "12" },
  { key: "description", header: "description", aliases: ["notes", "details", "technical notes"], example: "B22 base, 900 lumens" },
] as const;

export type ImportKey = (typeof IMPORT_COLUMNS)[number]["key"];

const normalise = (h: string) => h.trim().toLowerCase().replace(/[_\s]+/g, " ").replace(/[^a-z0-9 %/]/g, "");

/** Maps each file header to one of our columns (or null if unknown). */
export function matchHeaders(headers: string[]): (ImportKey | null)[] {
  return headers.map((h) => {
    const n = normalise(h);
    const col = IMPORT_COLUMNS.find((c) => normalise(c.header) === n || c.key.toLowerCase() === n.replace(/ /g, "") || (c.aliases as readonly string[]).includes(n));
    return col?.key ?? null;
  });
}
