import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangleIcon, ArrowRightIcon, ChevronLeftIcon, MessageSquareQuoteIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FlashToast } from "@/components/flash-toast";
import { RequestStatusBadge } from "@/components/requests/request-status";
import { ReviewPanel } from "@/components/requests/review-panel";
import { requirePageUser } from "@/server/session";
import { getRequest, type RequestDetail } from "@/server/queries/requests";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";

type Props = PageProps<"/requests/[id]">;

export default function RequestPage(props: Props) {
  return (
    <div className="max-w-3xl">
      <Link href="/requests" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Requests
      </Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Request params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Request({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const user = await requirePageUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const request = await getRequest(id);
  const reviewer = can(user.role, "request.review");
  // Employees can only open their own requests.
  if (!request || (!reviewer && request.requestedBy.id !== user.id)) notFound();

  return (
    <>
      {query.submitted ? (
        <FlashToast
          message={request.action === "CREATE_SALE" ? "Sale sent for approval. Stock is deducted once an Admin approves it." : "Request sent. You'll see the decision here."}
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{request.kind === "SALES" ? "Sales request" : "Inventory request"}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{request.title}</h1>
          <p className="mt-1 text-muted-foreground">
            Asked by {request.requestedBy.name} · {formatDateTime(request.createdAt)}
          </p>
        </div>
        <RequestStatusBadge status={request.status} className="text-sm" />
      </div>

      {request.reason ? (
        <blockquote className="mt-5 flex gap-3 rounded-xl bg-muted p-4">
          <MessageSquareQuoteIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <p>{request.reason}</p>
        </blockquote>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">
          {request.action === "CREATE_SALE"
            ? request.status === "PENDING"
              ? "Stock to deduct on approval"
              : "Products on this sale"
            : request.status === "APPROVED"
              ? "What was changed"
              : "What would change"}
        </h2>
        <Changes request={request} />
        <TargetLink request={request} />
      </section>

      {request.status !== "PENDING" ? (
        <section className={`mt-6 rounded-xl border p-5 ${request.status === "APPROVED" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
          <p className="font-medium">
            {request.status === "APPROVED" ? "Approved" : "Rejected"} by {request.reviewedBy}
            {request.reviewedAt ? ` · ${formatDateTime(request.reviewedAt)}` : ""}
          </p>
          {request.adminNote ? <p className="mt-1">“{request.adminNote}”</p> : null}
          {request.status === "REJECTED" ? <p className="mt-1 text-sm text-muted-foreground">Nothing was changed.</p> : null}
        </section>
      ) : reviewer ? (
        <div className="mt-6">
          <ReviewPanel requestId={request.id} requestedBy={request.requestedBy.name} />
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed p-4 text-muted-foreground">Waiting for an Admin to review this request.</p>
      )}
    </>
  );
}

function Changes({ request }: { request: RequestDetail }) {
  if (request.rows.length === 0 && request.items.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-muted-foreground">Employees can no longer ask for product or stock changes, so this older request can only be rejected.</p>;
  }
  return (
    <div className="grid gap-3">
      {request.rows.length > 0 ? (
        <dl className="divide-y rounded-xl border bg-card">
          {request.rows.map((row) => (
            <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4 sm:px-5">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0">
                {row.before !== undefined ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground line-through">{row.before}</span>
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                    <span className="font-medium">{row.after}</span>
                  </span>
                ) : (
                  <span className="font-medium whitespace-pre-line">{row.after}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {request.items.length > 0 ? (
        <ul className="divide-y rounded-xl border bg-card">
          {request.items.map((item) => (
            <li key={item.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <span className="min-w-0">
                <span className="block font-medium">{item.name}</span>
                {item.stock ? (
                  <span className={`flex items-center gap-1.5 text-sm tabular ${item.short ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                    {item.short ? <AlertTriangleIcon className="size-4" /> : null}
                    {item.stock}
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-2 tabular">
                {item.before !== undefined ? (
                  <>
                    <span className={item.before === item.after ? "" : "text-muted-foreground line-through"}>{item.before}</span>
                    {item.before !== item.after ? (
                      <>
                        <ArrowRightIcon className="size-4 text-muted-foreground" />
                        <span className="font-semibold">{item.after}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <span className={request.action === "CREATE_SALE" ? "font-semibold" : undefined}>
                    {request.action === "CREATE_SALE" ? `−${item.after}` : item.after}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TargetLink({ request }: { request: RequestDetail }) {
  if (request.saleId) {
    return (
      <Link href={`/sales/${request.saleId}`} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        Open sale <ArrowRightIcon className="size-4" />
      </Link>
    );
  }
  return null;
}
