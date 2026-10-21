"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { GlobalSearch } from "@/components/search/global-search";

// On phones the search bar opens from a magnifier button in the header.
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Search products" onClick={() => setOpen(true)}>
        <SearchIcon className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="top" className="min-h-[70dvh] gap-0 p-4 pt-12">
          <SheetTitle className="sr-only">Search products</SheetTitle>
          <GlobalSearch autoFocus onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
