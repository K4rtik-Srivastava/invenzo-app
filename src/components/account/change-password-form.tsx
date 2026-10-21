"use client";

import { useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { useAction } from "@/hooks/use-action";
import { changeOwnPasswordAction } from "@/server/actions/auth";

export function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { run, pending, fieldErrors } = useAction(changeOwnPasswordAction, {
    onSuccess: () => {
      formRef.current?.reset();
      if (mustChange) router.replace("/");
      router.refresh();
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run({
      currentPassword: String(form.get("currentPassword")),
      newPassword: String(form.get("newPassword")),
      confirmPassword: String(form.get("confirmPassword")),
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4">
      <FormField
        label={mustChange ? "Temporary password" : "Current password"}
        htmlFor="currentPassword"
        error={fieldErrors.currentPassword}
      >
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
      </FormField>
      <FormField label="New password" htmlFor="newPassword" error={fieldErrors.newPassword} hint="At least 8 characters.">
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" minLength={8} required />
      </FormField>
      <FormField label="Type the new password again" htmlFor="confirmPassword" error={fieldErrors.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
      </FormField>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Save new password
      </Button>
    </form>
  );
}
