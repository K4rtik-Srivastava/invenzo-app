import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangleIcon, InboxIcon, PackageIcon, PackageXIcon, PlusIcon, ReceiptTextIcon, ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelEmpty } from "@/components/dashboard/panel";
import { StatTile } from "@/components/dashboard/stat-tile";
import { StockBadge } from "@/components/products/stock-badge";
import { RequestStatusBadge } from "@/components/requests/request-status";
import { requirePageUser } from "@/server/session";
import { getRecentActivity, getRequestSummary, getRestockList, getStockSummary, getTodaySales } from "@/server/queries/dashboard";
import { can } from "@/lib/permissions";
import { APP_TIMEZONE, formatDateTime, formatQty } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default function DashboardPage(props: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}

function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "numeric", hour12: false }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function longDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(now);
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const user = await requirePageUser();
  const { denied } = await searchParams;
  const isAdmin = can(user.role, "request.review");

  const [stock, sales, requests, restock, activity] = await Promise.all([
    getStockSummary(),
    getTodaySales(),
    getRequestSummary({ requestedById: isAdmin ? undefined : user.id }),
    getRestockList(),
    isAdmin ? getRecentActivity() : Promise.resolve([]),
  ]);
  const salesDelta = sales.count - sales.yesterday;
  const todayHref = `/sales?from=${sales.today}&to=${sales.today}`;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground">{longDate()}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user.role, "product.manage") ? (
            <Button variant="outline" asChild>
              <Link href="/inventory/new">
                <PlusIcon /> Add product
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/sales/new">
              <ReceiptTextIcon /> Record sale
            </Link>
          </Button>
        </div>
      </div>

      {denied ? (
        <div role="alert" className="mb-6 flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-warning" />
          <p>That page is only available to Admins.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Products" value={stock.total} note="in your inventory" href="/inventory" icon={PackageIcon} />
        <StatTile label="Low stock" value={stock.low} note={stock.low ? "at or below low-stock level" : "all above their level"} href="/inventory?stock=low" icon={AlertTriangleIcon} tone="warning" />
        <StatTile label="Out of stock" value={stock.out} note={stock.out ? "can't be sold" : "nothing has run out"} href="/inventory?stock=out" icon={PackageXIcon} tone="critical" />
        <StatTile
          label="Sales today"
          value={sales.count}
          note={
            sales.count || sales.yesterday
              ? `${salesDelta === 0 ? "same as" : `${salesDelta > 0 ? "+" : "−"}${Math.abs(salesDelta)} vs`} yesterday · ${sales.lines} line${sales.lines === 1 ? "" : "s"}`
              : "none yet"
          }
          href={todayHref}
          icon={ReceiptTextIcon}
          tone="accent"
        />
        <div className="col-span-2 lg:col-span-1">
          <StatTile
            label={isAdmin ? "Pending requests" : "My pending requests"}
            value={requests.pending}
            note={requests.pending ? (isAdmin ? "waiting for your decision" : "waiting for an Admin") : "all caught up"}
            href="/requests"
            icon={InboxIcon}
            tone="accent"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Needs restocking" href="/inventory?stock=low" linkLabel="Low stock list">
          {restock.length === 0 ? (
            <PanelEmpty>Nothing is low on stock. 🎉</PanelEmpty>
          ) : (
            <ul className="divide-y">
              {restock.map((p) => (
                <li key={p.id}>
                  <Link href={`/inventory/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {p.brand ? `${p.brand} · ` : ""}low-stock level {formatQty(p.reorderLevel, p.unit)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular">{formatQty(p.currentStock, p.unit)}</span>
                      <StockBadge status={p.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Today’s sales" href={todayHref}>
          {sales.recent.length === 0 ? (
            <PanelEmpty>
              No sales recorded today.{" "}
              <Link href="/sales/new" className="text-primary hover:underline">
                Record one
              </Link>
            </PanelEmpty>
          ) : (
            <ul className="divide-y">
              {sales.recent.map((s) => (
                <li key={s.id}>
                  <Link href={`/sales/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.invoiceNumber}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {s.itemCount} product{s.itemCount === 1 ? "" : "s"}
                        {s.customerName ? ` · ${s.customerName}` : ""}
                      </p>
                    </div>
                    <p className="text-right text-sm text-muted-foreground">
                      {s.by}
                      <br />
                      {new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit" }).format(s.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <RequestsPanel isAdmin={isAdmin} requests={requests.recent} />

        {isAdmin ? (
          <Panel title="Recent activity" href="/audit" linkLabel="Audit log">
            {activity.length === 0 ? (
              <PanelEmpty>No activity yet.</PanelEmpty>
            ) : (
              <ol className="divide-y">
                {activity.map((a) => (
                  <li key={a.id} className="px-4 py-3 sm:px-5">
                    <p className="line-clamp-2">{a.summary}</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        ) : null}
      </div>
    </>
  );
}

function RequestsPanel({
  isAdmin,
  requests,
}: {
  isAdmin: boolean;
  requests: Awaited<ReturnType<typeof getRequestSummary>>["recent"];
}) {
  return (
    <Panel title={isAdmin ? "Waiting for your decision" : "My recent requests"} href="/requests">
      {requests.length === 0 ? (
        <PanelEmpty>{isAdmin ? "No requests waiting." : "Nothing sent yet. Sales you record wait here until an Admin approves them."}</PanelEmpty>
      ) : (
        <ul className="divide-y">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {isAdmin ? `${r.requestedBy} · ` : ""}
                    {formatDateTime(r.createdAt)}
                    {!isAdmin && r.adminNote ? ` · “${r.adminNote}”` : ""}
                  </p>
                </div>
                <RequestStatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-16 max-w-sm" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className={i === 4 ? "col-span-2 h-36 lg:col-span-1" : "h-36"} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}
