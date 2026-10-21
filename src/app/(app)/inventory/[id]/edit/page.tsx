import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/products/product-form";
import { requirePageUser } from "@/server/session";
import { getBrands, getProduct, getUnits } from "@/server/queries/products";

export const metadata = { title: "Edit product" };

export default function EditProductPage(props: PageProps<"/inventory/[id]/edit">) {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Form params={props.params} />
      </Suspense>
    </div>
  );
}

async function Form({ params }: { params: PageProps<"/inventory/[id]/edit">["params"] }) {
  await requirePageUser({ permission: "product.manage" });
  const { id } = await params;
  const [product, units, brands] = await Promise.all([getProduct(id, { includeCost: true }), getUnits(), getBrands()]);
  if (!product) notFound();
  return (
    <>
      <PageHeader title={`Edit ${product.name}`} />
      <ProductForm
        productId={product.id}
        units={units}
        brands={brands}
        cancelHref={`/inventory/${product.id}`}
        initial={{
          name: product.name,
          brand: product.brand ?? "",
          hsnCode: product.hsnCode ?? "",
          sku: product.sku ?? "",
          description: product.description ?? "",
          unitId: product.unitId,
          purchasePrice: product.purchasePrice ?? "",
          sellingPrice: product.sellingPrice ?? "",
          gstRate: product.gstRate ?? "",
          reorderLevel: product.reorderLevel,
          openingStock: product.openingStock,
        }}
      />
    </>
  );
}
