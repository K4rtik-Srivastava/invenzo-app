import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 mb-6 text-muted-foreground">You’ll be signed out of other devices.</p>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <ResetContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ResetContent({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const { token, error } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : null} invalid={Boolean(error)} />;
}
