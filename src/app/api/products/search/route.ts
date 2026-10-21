import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/session";
import { quickSearchProducts } from "@/server/queries/products";
import { can } from "@/lib/permissions";

// GET /api/products/search?q=led&page=1 → best-matching products for the search bar.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "product.view")) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const page = Number(request.nextUrl.searchParams.get("page")) || 1;
  const result = await quickSearchProducts(q, { page });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
