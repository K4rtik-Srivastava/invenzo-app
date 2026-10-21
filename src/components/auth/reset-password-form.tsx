"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token || invalid) {
    return (
      <p className="text-muted-foreground">
        This link is invalid or has expired.{" "}
        <Link href="/forgot-password" className="text-primary hover:underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword.length < 8) return setError("Use at least 8 characters.");
    if (newPassword !== String(form.get("confirm"))) return setError("The two passwords don't match.");
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword, token: token! });
    setPending(false);
    if (error) return setError("This link is invalid or has expired. Please request a new one.");
    toast.success("Password changed. Please sign in.");
    router.replace("/login");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormField label="New password" htmlFor="password" hint="At least 8 characters.">
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required autoFocus />
      </FormField>
      <FormField label="Type it again" htmlFor="confirm" error={error ?? undefined}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </FormField>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Save new password
      </Button>
    </form>
  );
}
