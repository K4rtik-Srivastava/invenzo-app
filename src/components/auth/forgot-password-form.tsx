"use client";

import { useState, type FormEvent } from "react";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "limited">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim().toLowerCase();
    setState("sending");
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    // Same message whether or not the email exists, so nobody can probe for accounts.
    setState(error?.status === 429 ? "limited" : "sent");
  }

  if (state === "sent") {
    return (
      <div className="flex gap-3 rounded-lg bg-muted p-4">
        <MailCheckIcon className="mt-0.5 size-5 shrink-0 text-success" />
        <p>If an account exists for that email, a reset link is on its way. It works for 1 hour.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormField label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </FormField>
      {state === "limited" ? (
        <p role="alert" className="text-sm text-destructive">Too many requests. Please try again in an hour.</p>
      ) : null}
      <Button type="submit" size="lg" disabled={state === "sending"} className="w-full">
        {state === "sending" ? <Loader2Icon className="animate-spin" /> : null}
        Send reset link
      </Button>
    </form>
  );
}
