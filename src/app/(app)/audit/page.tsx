import { Suspense } from "react";
import Link from "next/link";
import { ScrollTextIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditFilters } from "@/components/audit/audit-filters";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { requirePageUser } from "@/server/session";
import { AUDIT_PAGE_SIZE, auditActors, auditHref, auditSearchSchema, searchAudit } from "@/server/queries/audit";
import { formatDateTime, todayISO } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default function AuditPage(props: PageProps<"/audit">) {
  return (
    <>
      <PageHeader title="Audit log" description="Every change, who made it and when. Entries can't be edited or deleted." />
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <Audit searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Audit({ searchParams }: { searchParams: PageProps<"/audit">["searchParams"] }) {
  await requirePageUser({ permission: "audit.view" });
  const filters = auditSearchSchema.parse(await searchParams);
  const [{ rows, total, page, pageCount }, actors] = await Promise.all([searchAudit(filters), auditActors()]);
  const { page: _page, ...filterParams } = filters;
  void _page;

  return (
    <>
      <AuditFilters filters={filterParams} actors={actors} today={todayISO()} />
      {rows.length === 0 ? (
        <EmptyState icon={ScrollTextIcon} title="No matching entries" hint="Try a wider date range or clear the filters." />
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {rows.map((entry) => {
            const href = auditHref(entry.entityType, entry.entityId);
            return (
              <li key={entry.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
                <time className="shrink-0 text-sm text-muted-foreground tabular sm:w-44 sm:pt-0.5" dateTime={entry.createdAt.toISOString()}>
                  {formatDateTime(entry.createdAt)}
                </time>
                <p className="min-w-0 flex-1 break-words">
                  {entry.summary}
                  {href ? (
                    <>
                      {" "}
                      <Link href={href} className="whitespace-nowrap text-sm text-primary hover:underline">
                        Open
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      <Pager page={page} pageCount={pageCount} total={total} pageSize={AUDIT_PAGE_SIZE} basePath="/audit" params={filterParams} noun="entries" />
    </>
  );
}
