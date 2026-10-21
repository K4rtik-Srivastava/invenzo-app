import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { UnitList } from "@/components/products/unit-list";
import { requirePageUser } from "@/server/session";
import { getUnitsWithUsage } from "@/server/queries/products";

export const metadata = { title: "Units" };

export default function UnitsPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/inventory" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Inventory
      </Link>
      <PageHeader title="Units of measurement" description="Units you can choose when adding a product." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Units />
      </Suspense>
    </div>
  );
}

async function Units() {
  await requirePageUser({ permission: "product.manage" });
  return <UnitList units={await getUnitsWithUsage()} />;
}
