import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/server/session";
import { needsSetup } from "@/server/users";
import { emailEnabled } from "@/server/email";

export const metadata = { title: "Sign in" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-muted-foreground">Welcome back. Enter your email and password.</p>
      <Suspense fallback={<FormSkeleton />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection();
  if (await needsSetup()) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <LoginForm next={target} canEmailReset={emailEnabled()} />;
}

function FormSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-10" />
    </div>
  );
}
