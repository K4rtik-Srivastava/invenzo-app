import Link from "next/link";
import { Clock3Icon } from "lucide-react";

export function PendingRequestsNotice({ count, subject }: { count: number; subject: "sale" }) {
  if (count === 0) return null;
  return (
    <Link href="/requests" className="mt-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 hover:bg-warning/15">
      <Clock3Icon className="size-4 shrink-0 text-warning" />
      <span>
        {count === 1 ? "There's a change request" : `There are ${count} change requests`} waiting for this {subject}.
      </span>
    </Link>
  );
}
