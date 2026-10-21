import "server-only";
import ExcelJS from "exceljs";

export type Cell = string | number | null | undefined;
export type Column = { header: string; width?: number };

// A cell starting with = + - @ (or tab/CR) could run as a formula when the
// file is opened in Excel. Prefix such text with ' so it shows as plain text.
function safeText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: Cell) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value) : safeText(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV with a byte-order mark so Excel shows ₹ and Indian-language text correctly. */
export function toCsv(columns: Column[], rows: Cell[][]) {
  const lines = [columns.map((c) => csvCell(c.header)), ...rows.map((r) => r.map(csvCell))].map((cells) => cells.join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export async function toXlsx(sheetName: string, columns: Column[], rows: Cell[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 16 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row.map((v) => (typeof v === "string" ? safeText(v) : (v ?? null))));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function fileResponse(format: "csv" | "xlsx", baseName: string, sheetName: string, columns: Column[], rows: Cell[][]) {
  const filename = `${baseName}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };
  if (format === "xlsx") {
    return new Response(new Uint8Array(await toXlsx(sheetName, columns, rows)), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }
  return new Response(toCsv(columns, rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
}
