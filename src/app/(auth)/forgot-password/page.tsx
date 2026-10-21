import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { emailEnabled } from "@/server/email";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  const enabled = emailEnabled();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
      {enabled ? (
        <>
          <p className="mt-1 mb-6 text-muted-foreground">Enter your email and we’ll send you a link to choose a new one.</p>
          <ForgotPasswordForm />
        </>
      ) : (
        <p className="mt-2 text-muted-foreground">
          Please ask your admin to reset it. They can do this from the <strong>Users</strong> page and give you a temporary password.
        </p>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
