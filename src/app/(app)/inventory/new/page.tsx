import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/products/product-form";
import { requirePageUser } from "@/server/session";
import { getBrands, getUnits } from "@/server/queries/products";

export const metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add product" description="Fields marked * are required. Everything else can be filled in later." />
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  await requirePageUser({ permission: "product.manage" });
  const [units, brands] = await Promise.all([getUnits(), getBrands()]);
  return <ProductForm units={units} brands={brands} cancelHref="/inventory" />;
}
