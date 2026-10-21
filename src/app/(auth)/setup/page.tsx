import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { SetupForm } from "@/components/auth/setup-form";
import { needsSetup } from "@/server/users";

export const metadata = { title: "First-time setup" };

export default function SetupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome! Let’s get set up</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        Create the first Admin account. This screen is only shown once; after this, only Admins can add users.
      </p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SetupGate />
      </Suspense>
    </>
  );
}

async function SetupGate() {
  await connection();
  if (!(await needsSetup())) redirect("/login");
  return <SetupForm />;
}
