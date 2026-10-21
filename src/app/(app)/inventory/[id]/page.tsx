import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveIcon, ChevronLeftIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FlashToast } from "@/components/flash-toast";
import { Pager, pageNumber } from "@/components/pager";
import { MovementHistory } from "@/components/products/movement-history";
import { ProductActions } from "@/components/products/product-actions";
import { StockBadge } from "@/components/products/stock-badge";
import { requirePageUser } from "@/server/session";
import { getMovements, getProduct, MOVEMENT_PAGE_SIZE } from "@/server/queries/products";
import { can } from "@/lib/permissions";
import { formatDateTime, formatMoney, formatPercent, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = PageProps<"/inventory/[id]">;

export default function ProductPage(props: Props) {
  return (
    <>
      <Link href="/inventory" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Inventory
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <Product params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Product({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const user = await requirePageUser({ permission: "product.view" });
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const isAdmin = can(user.role, "product.manage");
  const page = pageNumber(query.page);
  const [product, movements] = await Promise.all([getProduct(id, { includeCost: can(user.role, "product.viewCost") }), getMovements(id, page)]);
  if (!product) notFound();

  return (
    <>
      {query.created ? <FlashToast message="Product added." /> : query.saved ? <FlashToast message="Changes saved." /> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
          <p className="mt-1 text-muted-foreground">{[product.brand, product.sku].filter(Boolean).join(" · ") || "No brand or SKU"}</p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <ProductActions
              productId={product.id}
              name={product.name}
              unit={product.unit}
              currentStock={product.currentStock}
              isArchived={product.isArchived}
            />
          </div>
        ) : null}
      </div>

      {product.isArchived ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-muted-foreground">
          <ArchiveIcon className="size-4" /> This product is archived. It can’t be sold or adjusted until it’s restored.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section
          className={cn(
            "rounded-xl border p-5",
            product.status === "out" ? "border-destructive/30 bg-destructive/5" : product.status === "low" ? "border-warning/30 bg-warning/5" : "bg-card",
          )}
        >
          <p className="text-sm text-muted-foreground">Available stock</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular">{formatQty(product.currentStock, product.unit)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StockBadge status={product.status} />
            <span className="text-sm text-muted-foreground">Low-stock level {formatQty(product.reorderLevel, product.unit)}</span>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Detail label="Selling price">{formatMoney(product.sellingPrice)}</Detail>
            {can(user.role, "product.viewCost") ? <Detail label="Purchase price">{formatMoney(product.purchasePrice)}</Detail> : null}
            <Detail label="GST rate">{formatPercent(product.gstRate)}</Detail>
            <Detail label="HSN code">{product.hsnCode ?? "—"}</Detail>
            <Detail label="Unit">{product.unit}</Detail>
            <Detail label="Opening stock">{formatQty(product.openingStock, product.unit)}</Detail>
          </dl>
        </section>
      </div>

      {product.description ? (
        <section className="mt-4 rounded-xl border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">Description & technical notes</h2>
          <p className="mt-2 whitespace-pre-line">{product.description}</p>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Movement history</h2>
          <p className="text-sm text-muted-foreground">Updated {formatDateTime(product.updatedAt)}</p>
        </div>
        <MovementHistory rows={movements.rows} unit={product.unit} />
        <Pager
          page={page}
          pageCount={movements.pageCount}
          total={movements.total}
          pageSize={MOVEMENT_PAGE_SIZE}
          basePath={`/inventory/${product.id}`}
          noun="movements"
        />
      </section>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium tabular">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-16 max-w-md" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36 lg:col-span-2" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
