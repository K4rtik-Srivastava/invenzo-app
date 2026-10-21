"use client";

import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildHref } from "@/lib/url";

// Downloads exactly what's on screen (same search & filters), as CSV or Excel.
export function ExportMenu({ endpoint, params, label = "Export" }: { endpoint: string; params: Record<string, string | undefined>; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <DownloadIcon /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal text-muted-foreground">Uses your current filters</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={buildHref(endpoint, { ...params, format: "xlsx" })} download>
            <FileSpreadsheetIcon /> Excel (.xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={buildHref(endpoint, { ...params, format: "csv" })} download>
            <FileTextIcon /> CSV
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
