import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-lg font-medium">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
