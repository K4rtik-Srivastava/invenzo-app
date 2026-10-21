"use client";

import { useState, type FormEvent } from "react";
import { CheckIcon, CopyIcon, Loader2Icon, RefreshCwIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { useAction } from "@/hooks/use-action";
import { createUserAction } from "@/server/actions/users";
import { generateTempPassword } from "@/lib/temp-password";

export function AddUserButton() {
  const [open, setOpen] = useState(false);
  // Generated when the dialog opens (never during page rendering).
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const { run, pending, fieldErrors, setFieldErrors } = useAction(createUserAction, {
    successToast: false,
    onSuccess: (_result, input) => setCreated({ name: input.name, email: input.email, password: input.password }),
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    setCreated(null);
    setFieldErrors({});
    if (next) setPassword(generateTempPassword());
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run({
      name: String(form.get("name")),
      email: String(form.get("email")),
      role: form.get("role") as "ADMIN" | "EMPLOYEE",
      password: String(form.get("password")),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <CreatedNotice details={created} onDone={() => onOpenChange(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a user</DialogTitle>
              <DialogDescription>They’ll be asked to choose their own password the first time they sign in.</DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid gap-4">
              <FormField label="Name" htmlFor="new-name" error={fieldErrors.name}>
                <Input id="new-name" name="name" required autoFocus />
              </FormField>
              <FormField label="Email" htmlFor="new-email" error={fieldErrors.email}>
                <Input id="new-email" name="email" type="email" required />
              </FormField>
              <FormField label="Role" htmlFor="new-role" hint="Employees can view stock and record sales, which an Admin approves. Admins can change everything.">
                <NativeSelect id="new-role" name="role" defaultValue="EMPLOYEE">
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ADMIN">Admin</option>
                </NativeSelect>
              </FormField>
              <FormField label="Temporary password" htmlFor="new-password" error={fieldErrors.password}>
                <div className="flex gap-2">
                  <Input id="new-password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className="font-mono" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generateTempPassword())} aria-label="Generate another password">
                    <RefreshCwIcon />
                  </Button>
                </div>
              </FormField>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2Icon className="animate-spin" /> : null}
                  Create user
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreatedNotice({ details, onDone }: { details: { name: string; email: string; password: string }; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Sign in at ${typeof window !== "undefined" ? window.location.origin : ""}\nEmail: ${details.email}\nTemporary password: ${details.password}`;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{details.name} has been added</DialogTitle>
        <DialogDescription>Share these sign-in details with them. The password won’t be shown again.</DialogDescription>
      </DialogHeader>
      <pre className="rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap">{text}</pre>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
        </Button>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}
