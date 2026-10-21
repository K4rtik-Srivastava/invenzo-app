import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { ImportProducts } from "@/components/products/import-products";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Import products" };

export default function ImportPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/inventory" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Inventory
      </Link>
      <PageHeader title="Import products" description="Add many products at once from a spreadsheet. Every row is checked before anything is saved." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  await requirePageUser({ permission: "product.import" });
  return <ImportProducts />;
}
