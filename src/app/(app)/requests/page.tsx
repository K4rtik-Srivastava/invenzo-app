import { Suspense } from "react";
import Link from "next/link";
import { InboxIcon, ReceiptTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pager, pageNumber } from "@/components/pager";
import { RequestStatusBadge } from "@/components/requests/request-status";
import { requirePageUser } from "@/server/session";
import { listRequests, REQUEST_PAGE_SIZE } from "@/server/queries/requests";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { REQUEST_STATUS_FILTERS } from "@/lib/validation/requests";
import { buildHref } from "@/lib/url";
import { cn } from "@/lib/utils";

export const metadata = { title: "Requests" };

const TAB_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected", all: "All" } as const;

export default function RequestsPage(props: PageProps<"/requests">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Requests searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Requests({ searchParams }: { searchParams: PageProps<"/requests">["searchParams"] }) {
  const user = await requirePageUser();
  const params = await searchParams;
  const reviewer = can(user.role, "request.review");
  const status = REQUEST_STATUS_FILTERS.find((s) => s === params.status) ?? "pending";
  const page = pageNumber(params.page);
  const { rows, total, pageCount, counts, page: safePage } = await listRequests({ status, page, requestedById: reviewer ? undefined : user.id });

  return (
    <>
      <PageHeader
        title="Requests"
        description={
          reviewer
            ? "Sales and corrections from your staff. Approving applies them straight away, and stock is updated."
            : "Sales you've recorded and changes you've asked for. Stock changes once an Admin approves."
        }
        actions={
          can(user.role, "request.create") ? (
            <Button asChild>
              <Link href="/sales/new">
                <ReceiptTextIcon /> Record sale
              </Link>
            </Button>
          ) : null
        }
      />

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" aria-label="Filter by status">
        {REQUEST_STATUS_FILTERS.map((tab) => {
          const count = tab === "all" ? undefined : counts[tab.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED"];
          return (
            <Link
              key={tab}
              href={buildHref("/requests", { status: tab === "pending" ? undefined : tab })}
              aria-current={tab === status ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground",
                tab === status && "bg-background text-foreground shadow-sm",
              )}
            >
              {TAB_LABEL[tab]}
              {count ? <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular">{count}</span> : null}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title={status === "pending" ? "No pending requests" : `No ${TAB_LABEL[status].toLowerCase()} requests`}
          hint={
            reviewer
              ? "When an Employee records a sale or asks for a correction, it will appear here for you to approve or reject."
              : "Sales you record appear here until an Admin approves them. To correct a sale, open it and tap “Request change”."
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.title}</p>
                  {r.reason ? <p className="truncate text-sm text-muted-foreground">“{r.reason}”</p> : null}
                  {r.adminNote && r.status !== "PENDING" ? <p className="truncate text-sm">Admin: {r.adminNote}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <RequestStatusBadge status={r.status} />
                  <p className="text-sm text-muted-foreground">
                    {reviewer ? `${r.requestedBy} · ` : ""}
                    {formatDateTime(r.createdAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={safePage} pageCount={pageCount} total={total} pageSize={REQUEST_PAGE_SIZE} basePath="/requests" params={{ status: status === "pending" ? undefined : status }} noun="requests" />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton className="mb-2 h-16 max-w-sm" />
      <Skeleton className="mb-2 h-11" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-18" />
      ))}
    </div>
  );
}
