"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon, MoreHorizontalIcon, PencilIcon, ShieldIcon, UserIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { useAction } from "@/hooks/use-action";
import { resetUserPasswordAction, updateUserAction } from "@/server/actions/users";
import { generateTempPassword } from "@/lib/temp-password";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
};

type Pending =
  | { kind: "role"; user: UserRow }
  | { kind: "status"; user: UserRow }
  | { kind: "rename"; user: UserRow }
  | { kind: "password"; user: UserRow }
  | null;

export function UserList({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [pending, setPending] = useState<Pending>(null);
  const close = () => setPending(null);

  return (
    <>
      <ul className="divide-y rounded-xl border bg-card">
        {users.map((user) => (
          <li key={user.id} className={cn("flex items-center gap-3 px-4 py-3 sm:px-5", !user.isActive && "opacity-60")}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <span className="truncate">{user.name}</span>
                {user.id === currentUserId ? <span className="text-sm font-normal text-muted-foreground">(you)</span> : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
              <RoleBadge role={user.role} />
              <StatusBadges user={user} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Actions for ${user.name}`}>
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setPending({ kind: "rename", user })}>
                  <PencilIcon /> Edit name
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPending({ kind: "role", user })}>
                  {user.role === "ADMIN" ? <UserIcon /> : <ShieldIcon />}
                  {user.role === "ADMIN" ? "Make Employee" : "Make Admin"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPending({ kind: "password", user })}>
                  <KeyRoundIcon /> Reset password
                </DropdownMenuItem>
                {user.id !== currentUserId ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant={user.isActive ? "destructive" : "default"}
                      onSelect={() => setPending({ kind: "status", user })}
                    >
                      {user.isActive ? <UserXIcon /> : <UserCheckIcon />}
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="sr-only sm:hidden">
              {ROLE_LABEL[user.role]}, {user.isActive ? "active" : "deactivated"}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground sm:hidden">Tap ••• next to a person to change their role or password.</p>

      {pending?.kind === "role" ? <RoleDialog user={pending.user} onClose={close} /> : null}
      {pending?.kind === "status" ? <StatusDialog user={pending.user} onClose={close} /> : null}
      {pending?.kind === "rename" ? <RenameDialog user={pending.user} onClose={close} /> : null}
      {pending?.kind === "password" ? <PasswordDialog user={pending.user} onClose={close} /> : null}
    </>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return role === "ADMIN" ? <Badge>Admin</Badge> : <Badge variant="secondary">Employee</Badge>;
}

function StatusBadges({ user }: { user: UserRow }) {
  if (!user.isActive) return <Badge variant="outline">Deactivated</Badge>;
  if (user.mustChangePassword) return <Badge variant="outline">Temporary password</Badge>;
  return null;
}

function RoleDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { run, pending } = useAction(updateUserAction, { onSuccess: onClose });
  const toAdmin = user.role !== "ADMIN";
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={toAdmin ? `Make ${user.name} an Admin?` : `Make ${user.name} an Employee?`}
      description={
        toAdmin
          ? "Admins can change stock, edit and cancel sales, approve requests and manage users."
          : "They will only be able to view, record sales and send change requests."
      }
      confirmLabel={toAdmin ? "Make Admin" : "Make Employee"}
      pending={pending}
      onConfirm={() => run({ userId: user.id, role: toAdmin ? "ADMIN" : "EMPLOYEE" })}
    />
  );
}

function StatusDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { run, pending } = useAction(updateUserAction, { onSuccess: onClose });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={user.isActive ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`}
      description={
        user.isActive
          ? "They will be signed out on all devices and won't be able to sign in. Their history stays in the records."
          : "They will be able to sign in again with their current password."
      }
      confirmLabel={user.isActive ? "Deactivate" : "Reactivate"}
      destructive={user.isActive}
      pending={pending}
      onConfirm={() => run({ userId: user.id, isActive: !user.isActive })}
    />
  );
}

function RenameDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const { run, pending, fieldErrors } = useAction(updateUserAction, { onSuccess: onClose });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit name"
      description={user.email}
      confirmLabel="Save"
      pending={pending}
      onConfirm={() => run({ userId: user.id, name })}
    >
      <FormField label="Name" htmlFor="rename" error={fieldErrors.name}>
        <Input id="rename" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </FormField>
    </ConfirmDialog>
  );
}

function PasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password] = useState(generateTempPassword);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const { run, pending } = useAction(resetUserPasswordAction, { onSuccess: () => setDone(true) });

  if (done) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title="Password reset"
        description={`Give ${user.name} this temporary password. They'll choose a new one when they sign in.`}
        confirmLabel="Done"
        onConfirm={onClose}
      >
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-muted px-4 py-3 font-mono text-lg">{password}</code>
          <Button
            variant="outline"
            size="icon"
            aria-label="Copy password"
            onClick={async () => {
              await navigator.clipboard.writeText(password);
              setCopied(true);
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
      </ConfirmDialog>
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Reset password for ${user.name}?`}
      description="Their current password will stop working and they'll be signed out everywhere. You'll get a temporary password to give them."
      confirmLabel="Reset password"
      destructive
      pending={pending}
      onConfirm={() => run({ userId: user.id, password })}
    />
  );
}
