import { CheckCircle2Icon, Clock3Icon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RequestStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const INFO: Record<RequestStatus, { label: string; icon: typeof Clock3Icon; className: string }> = {
  PENDING: { label: "Pending", icon: Clock3Icon, className: "bg-warning/15 text-warning" },
  APPROVED: { label: "Approved", icon: CheckCircle2Icon, className: "bg-success/10 text-success" },
  REJECTED: { label: "Rejected", icon: XCircleIcon, className: "bg-destructive/10 text-destructive" },
};

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = INFO[status];
  return (
    <Badge variant="secondary" className={cn("gap-1 font-medium", tone, className)}>
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}
