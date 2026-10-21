import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "lucide-react";

export function Panel({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="flex items-center gap-1 text-sm text-primary hover:underline">
            {linkLabel ?? "See all"} <ArrowRightIcon className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-muted-foreground sm:px-5">{children}</p>;
}
