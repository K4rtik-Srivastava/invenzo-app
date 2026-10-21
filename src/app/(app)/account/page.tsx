import { Suspense } from "react";
import { KeyRoundIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { requirePageUser } from "@/server/session";
import { ROLE_LABEL } from "@/lib/permissions";

export const metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-md" />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await requirePageUser({ allowPasswordChange: true });
  return (
    <div className="max-w-md">
      <PageHeader title="My account" description={`${user.name} · ${user.email} · ${ROLE_LABEL[user.role]}`} />
      {user.mustChangePassword ? (
        <div role="status" className="mb-6 flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <KeyRoundIcon className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>You’re using a temporary password. Please choose your own password to continue.</p>
        </div>
      ) : null}
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Change password</h2>
        <ChangePasswordForm mustChange={user.mustChangePassword} />
      </section>
    </div>
  );
}
