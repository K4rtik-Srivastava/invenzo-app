"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { AlertTriangleIcon, CheckCircle2Icon, DownloadIcon, FileUpIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { importProductsAction } from "@/server/actions/products";
import type { ImportSummary } from "@/server/import";
import { IMPORT_COLUMNS, matchHeaders, type ImportKey } from "@/lib/import-columns";
import { MAX_IMPORT_ROWS, type ImportRow } from "@/lib/validation/import";

type Parsed = { fileName: string; rows: ImportRow[]; matched: ImportKey[]; ignored: string[] };

export function ImportProducts() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [createUnits, setCreateUnits] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const check = useAction(importProductsAction, { onSuccess: (r) => setSummary(r.data ?? null) });
  const run = useAction(importProductsAction, { onSuccess: (r) => setSummary(r.data ?? null) });

  function reset() {
    setParsed(null);
    setSummary(null);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > 3.5 * 1024 * 1024) return setFileError("That file is too big (over 3.5 MB). Split it into smaller files.");
    if (!/\.csv$/i.test(file.name)) return setFileError("Please choose a .csv file. In Excel: File → Save As → “CSV UTF-8”.");
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: ({ data }) => {
        const [header, ...lines] = data;
        if (!header || lines.length === 0) return setFileError("The file is empty, or only has a header row.");
        const keys = matchHeaders(header);
        if (!keys.includes("name") || !keys.includes("unit")) {
          return setFileError("The file needs at least a “name” and a “unit” column. Download the template to see the expected columns.");
        }
        if (lines.length > MAX_IMPORT_ROWS) return setFileError(`The file has ${lines.length.toLocaleString("en-IN")} rows; import up to ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} at a time.`);
        const rows = lines.map((cells) => {
          const row: ImportRow = {};
          keys.forEach((key, i) => {
            if (key && cells[i] !== undefined && cells[i].trim() !== "") row[key] = cells[i].trim();
          });
          return row;
        });
        const next = { fileName: file.name, rows, matched: keys.filter((k): k is ImportKey => k !== null), ignored: header.filter((_, i) => keys[i] === null) };
        setParsed(next);
        check.run({ rows, createMissingUnits: createUnits, dryRun: true });
      },
      error: () => setFileError("That file couldn't be read. Make sure it's a CSV file."),
    });
  }

  function recheck(nextCreateUnits: boolean) {
    setCreateUnits(nextCreateUnits);
    if (parsed) check.run({ rows: parsed.rows, createMissingUnits: nextCreateUnits, dryRun: true });
  }

  const done = summary?.imported !== undefined;

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">1. Prepare your file</h2>
        <p className="mt-1 text-muted-foreground">
          One product per row. Required columns: <strong>name</strong> and <strong>unit</strong>. Optional: {IMPORT_COLUMNS.filter((c) => !("required" in c)).map((c) => c.header).join(", ")}.
          In Excel or Google Sheets, save as <strong>CSV</strong>.
        </p>
        <Button variant="outline" className="mt-3" asChild>
          <a href="/api/export/import-template" download>
            <DownloadIcon /> Download template
          </a>
        </Button>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">2. Upload and check</h2>
        <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/40">
          <FileUpIcon className="size-8 text-muted-foreground" />
          <span className="font-medium">{parsed ? parsed.fileName : "Choose a CSV file"}</span>
          <span className="text-sm text-muted-foreground">{parsed ? `${parsed.rows.length.toLocaleString("en-IN")} rows` : `Up to ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} products`}</span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileError ? (
          <p role="alert" className="mt-3 text-destructive">
            {fileError}
          </p>
        ) : null}
        {parsed && parsed.ignored.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Ignored columns (not recognised): {parsed.ignored.join(", ")}</p>
        ) : null}
        <div className="mt-4 flex items-center gap-2">
          <Checkbox id="create-units" checked={createUnits} onCheckedChange={(v) => recheck(v === true)} />
          <Label htmlFor="create-units" className="font-normal">
            Create units that don’t exist yet (e.g. “carton”)
          </Label>
        </div>
      </section>

      {check.pending ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Checking every row…
        </p>
      ) : null}

      {summary && parsed && !check.pending ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">3. {done ? "Done" : "Review and import"}</h2>
          {done ? (
            <div className="mt-3 flex gap-3 rounded-lg bg-success/10 p-4">
              <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <p className="font-medium">{summary.imported!.toLocaleString("en-IN")} products imported, with their opening stock.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/inventory">Go to Inventory</Link>
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    <RotateCcwIcon /> Import another file
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <ul className="mt-3 grid gap-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-success" /> {summary.valid.toLocaleString("en-IN")} of {summary.total.toLocaleString("en-IN")} rows are ready
                </li>
                {summary.problemCount > 0 ? (
                  <li className="flex items-center gap-2">
                    <AlertTriangleIcon className="size-4 text-destructive" /> {summary.problemCount.toLocaleString("en-IN")} row{summary.problemCount === 1 ? " has" : "s have"} problems
                  </li>
                ) : null}
                {summary.newUnits.length > 0 ? <li className="text-sm text-muted-foreground">New units to be created: {summary.newUnits.join(", ")}</li> : null}
              </ul>

              {summary.problemCount > 0 ? (
                <>
                  <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">Line</th>
                          <th className="px-3 py-2 font-medium">Product</th>
                          <th className="px-3 py-2 font-medium">What’s wrong</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {summary.problems.map((p) => (
                          <tr key={p.line} className="align-top">
                            <td className="px-3 py-2 tabular">{p.line}</td>
                            <td className="px-3 py-2">{p.name}</td>
                            <td className="px-3 py-2">
                              {p.messages.map((m) => (
                                <p key={m}>{m}</p>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {summary.problemCount > summary.problems.length ? (
                    <p className="mt-2 text-sm text-muted-foreground">Showing the first {summary.problems.length} problems.</p>
                  ) : null}
                  <p className="mt-3 text-muted-foreground">Nothing is imported until every row is fine. Fix these lines in your spreadsheet, save as CSV and upload it again.</p>
                </>
              ) : (
                <Button size="lg" className="mt-4" disabled={run.pending} onClick={() => run.run({ rows: parsed.rows, createMissingUnits: createUnits, dryRun: false })}>
                  {run.pending ? <Loader2Icon className="animate-spin" /> : null}
                  Import {summary.valid.toLocaleString("en-IN")} products
                </Button>
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
