"use client";

import type { FormEvent } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { useAction } from "@/hooks/use-action";
import { setupAction } from "@/server/actions/auth";

export function SetupForm() {
  const { run, pending, fieldErrors } = useAction(setupAction);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run({ name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")) });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormField label="Your name" htmlFor="name" error={fieldErrors.name}>
        <Input id="name" name="name" autoComplete="name" required autoFocus />
      </FormField>
      <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <FormField label="Password" htmlFor="password" error={fieldErrors.password} hint="At least 8 characters.">
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
      </FormField>
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Create Admin account
      </Button>
    </form>
  );
}
