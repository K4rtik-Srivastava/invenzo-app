import { Suspense, cache } from "react";
import Link from "next/link";
import { PackageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { GlobalSearch } from "@/components/search/global-search";
import { MobileSearch } from "@/components/search/mobile-search";
import { requirePageUser } from "@/server/session";
import { can } from "@/lib/permissions";
import { db } from "@/server/db";
import { APP_NAME } from "@/lib/brand";

// The frame around every signed-in page. The parts that depend on who is
// signed in stream in behind <Suspense>, so the frame itself shows instantly.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r bg-sidebar px-3 py-5 md:flex">
        <Brand />
        <div className="mt-6 flex-1">
          <Suspense fallback={<NavSkeleton />}>
            <SidebarSection />
          </Suspense>
        </div>
        <Suspense fallback={<Skeleton className="h-14" />}>
          <AccountSection />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <MobileSearch />
            <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
              <AccountSection compact />
            </Suspense>
          </div>
        </header>
        <div className="no-print sticky top-0 z-30 hidden h-18 items-center border-b bg-background/95 px-6 backdrop-blur md:flex lg:px-10">
          <div className="w-full max-w-2xl">
            <GlobalSearch shortcut />
          </div>
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pt-8 md:pb-12 lg:px-10">{children}</main>
      </div>

      <Suspense fallback={null}>
        <BottomSection />
      </Suspense>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 text-lg font-semibold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <PackageIcon className="size-4.5" />
      </span>
      <span className="truncate tracking-wide">{APP_NAME}</span>
    </Link>
  );
}

const pendingRequestCount = cache(async (role: "ADMIN" | "EMPLOYEE") =>
  can(role, "request.review") ? db.changeRequest.count({ where: { status: "PENDING" } }) : 0,
);

async function SidebarSection() {
  const user = await requirePageUser({ allowPasswordChange: true });
  return <SidebarNav role={user.role} pendingRequests={await pendingRequestCount(user.role)} />;
}

async function BottomSection() {
  const user = await requirePageUser({ allowPasswordChange: true });
  return <BottomNav role={user.role} pendingRequests={await pendingRequestCount(user.role)} />;
}

async function AccountSection({ compact = false }: { compact?: boolean }) {
  const user = await requirePageUser({ allowPasswordChange: true });
  return <UserMenu name={user.name} email={user.email} role={user.role} compact={compact} />;
}

function NavSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-11" />
      ))}
    </div>
  );
}
