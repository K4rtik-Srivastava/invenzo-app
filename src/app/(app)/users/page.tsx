import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { AddUserButton } from "@/components/users/add-user-dialog";
import { UserList } from "@/components/users/user-list";
import { requirePageUser } from "@/server/session";
import { db } from "@/server/db";

export const metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <>
      <Suspense fallback={<ListSkeleton />}>
        <Users />
      </Suspense>
    </>
  );
}

async function Users() {
  const me = await requirePageUser({ permission: "user.manage" });
  const users = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true },
  });
  return (
    <>
      <PageHeader title="Users" description="Who can sign in, and what they can do." actions={<AddUserButton />} />
      <UserList users={users} currentUserId={me.id} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton className="mb-4 h-16 max-w-sm" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-18" />
      ))}
    </div>
  );
}
