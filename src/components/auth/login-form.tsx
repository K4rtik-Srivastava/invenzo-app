"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ next, canEmailReset }: { next: string; canEmailReset: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password")),
    });
    if (error) {
      setPending(false);
      if (error.status === 429) {
        setError("Too many sign-in attempts. Please wait 15 minutes and try again.");
      } else if (error.status === 403) {
        setError(error.message || "This account has been deactivated.");
      } else {
        setError("That email and password don't match. Please try again.");
      }
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
      <FormField label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      </FormField>
      <FormField label="Password" htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </FormField>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {canEmailReset ? (
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot your password?
          </Link>
        ) : (
          "Forgot your password? Ask your admin to reset it."
        )}
      </p>
    </form>
  );
}
