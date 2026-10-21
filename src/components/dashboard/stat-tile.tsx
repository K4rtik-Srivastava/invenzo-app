import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "warning" | "critical" | "accent";

const TONES: Record<Tone, { icon: string; ring: string }> = {
  neutral: { icon: "bg-muted text-muted-foreground", ring: "" },
  accent: { icon: "bg-primary/10 text-primary", ring: "" },
  warning: { icon: "bg-warning/15 text-warning", ring: "border-warning/30" },
  critical: { icon: "bg-destructive/10 text-destructive", ring: "border-destructive/30" },
};

// A headline number with a label and a short note, linking to the full list.
// The status (low / out of stock) is carried by icon + label, never colour alone.
export function StatTile({
  label,
  value,
  note,
  href,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  note?: string;
  href: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const t = TONES[value > 0 ? tone : "neutral"];
  return (
    <Link href={href} className={cn("group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40 sm:p-5", t.ring)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("flex size-9 items-center justify-center rounded-lg", t.icon)}>
          <Icon className="size-5" />
        </span>
        <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-tight">{value.toLocaleString("en-IN")}</p>
        <p className="mt-0.5 font-medium">{label}</p>
        {note ? <p className="mt-0.5 text-sm text-muted-foreground">{note}</p> : null}
      </div>
    </Link>
  );
}
