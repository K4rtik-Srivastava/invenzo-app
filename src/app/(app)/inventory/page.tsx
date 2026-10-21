import { Suspense } from "react";
import Link from "next/link";
import { ArchiveIcon, PackageOpenIcon, PlusIcon, RulerIcon, SearchXIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { FlashToast } from "@/components/flash-toast";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { StockBadge } from "@/components/products/stock-badge";
import { Highlight } from "@/components/search/highlight";
import { InventoryFilters } from "@/components/search/inventory-filters";
import { ExportMenu } from "@/components/export-menu";
import { requirePageUser } from "@/server/session";
import { getBrands, getUnits, PRODUCT_PAGE_SIZE, searchProducts } from "@/server/queries/products";
import { can } from "@/lib/permissions";
import { formatMoney, formatQty } from "@/lib/format";
import { parseProductSearch, searchTerms } from "@/lib/validation/search";
import { cn } from "@/lib/utils";
import { buildHref } from "@/lib/url";

export const metadata = { title: "Inventory" };

export default function InventoryPage(props: PageProps<"/inventory">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Inventory searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Inventory({ searchParams }: { searchParams: PageProps<"/inventory">["searchParams"] }) {
  const user = await requirePageUser({ permission: "product.view" });
  const raw = await searchParams;
  const filters = parseProductSearch(raw);
  const isAdmin = can(user.role, "product.manage");
  const [{ rows, total, page, pageCount }, brands, units] = await Promise.all([
    searchProducts(filters, { canSeeArchived: isAdmin }),
    getBrands(),
    getUnits(),
  ]);
  const filtered = Boolean(filters.q || filters.brand || filters.unit || filters.stock);
  const terms = searchTerms(filters.q);
  const showArchived = isAdmin && Boolean(filters.archived);
  const pagerParams = { q: filters.q, brand: filters.brand, unit: filters.unit, stock: filters.stock, sort: filters.sort === "name" ? undefined : filters.sort, archived: filters.archived };

  return (
    <>
      {raw.deleted ? <FlashToast message="Product deleted." /> : null}
      <PageHeader
        title="Inventory"
        description={
          filtered
            ? `${total.toLocaleString("en-IN")} matching product${total === 1 ? "" : "s"}`
            : `${total.toLocaleString("en-IN")} product${total === 1 ? "" : "s"}${showArchived ? " including archived" : ""}`
        }
        actions={
          isAdmin ? (
            <>
              <ExportMenu endpoint="/api/export/inventory" params={pagerParams} />
              <Button variant="outline" asChild>
                <Link href="/inventory/import">
                  <UploadIcon /> Import
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/inventory/units">
                  <RulerIcon /> Units
                </Link>
              </Button>
              <Button asChild>
                <Link href="/inventory/new">
                  <PlusIcon /> Add product
                </Link>
              </Button>
            </>
          ) : (
            can(user.role, "inventory.export") ? <ExportMenu endpoint="/api/export/inventory" params={pagerParams} /> : null
          )
        }
      />

      <InventoryFilters filters={filters} brands={brands} units={units} />

      {isAdmin ? (
        <div className="mb-3 flex justify-end">
          <Link
            href={buildHref("/inventory", { ...pagerParams, archived: showArchived ? undefined : "1" })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArchiveIcon className="size-4" />
            {showArchived ? "Hide archived products" : "Include archived products"}
          </Link>
        </div>
      ) : null}

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchXIcon}
            title="No matching products"
            hint={filters.q ? `Nothing matches “${filters.q}”. Check the spelling, or try fewer words or filters.` : "Try removing a filter."}
            action={
              <Button variant="outline" asChild>
                <Link href="/inventory">Clear search and filters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={PackageOpenIcon}
            title="No products yet"
            hint={isAdmin ? "Add your first product, or import a list from a spreadsheet later." : "Products added by your admin will appear here."}
            action={
              isAdmin ? (
                <Button asChild>
                  <Link href="/inventory/new">
                    <PlusIcon /> Add product
                  </Link>
                </Button>
              ) : null
            }
          />
        )
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                href={`/inventory/${p.id}`}
                className={cn("flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5", p.isArchived && "opacity-60")}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    <Highlight text={p.name} terms={terms} />
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[p.brand, p.sku, p.hsnCode ? `HSN ${p.hsnCode}` : null, p.isArchived ? "Archived" : null]
                      .filter((part): part is string => Boolean(part))
                      .map((part, i) => (
                        <span key={i}>
                          {i > 0 ? " · " : null}
                          <Highlight text={part} terms={terms} />
                        </span>
                      ))}
                    {" "}
                  </p>
                </div>
                <div className="hidden w-28 text-right text-sm text-muted-foreground tabular sm:block">{formatMoney(p.sellingPrice)}</div>
                <div className="flex w-32 flex-col items-end gap-1 sm:w-40">
                  <span className="font-semibold tabular">{formatQty(p.currentStock, p.unit)}</span>
                  {p.status !== "in" ? <StockBadge status={p.status} /> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pageCount={pageCount} total={total} pageSize={PRODUCT_PAGE_SIZE} basePath="/inventory" params={pagerParams} noun="products" />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton className="mb-2 h-16 max-w-sm" />
      <Skeleton className="h-11" />
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}
