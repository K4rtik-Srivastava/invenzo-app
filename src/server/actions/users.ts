"use server";

import { refresh } from "next/cache";
import { defineAction } from "@/server/action";
import { createUser, resetUserPassword, updateUser } from "@/server/users";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "@/lib/validation/users";

export const createUserAction = defineAction(
  { permission: "user.manage", schema: createUserSchema },
  async (input, actor) => {
    const user = await createUser(actor, input);
    refresh();
    return { ok: true, message: `${user.name} can now sign in with the temporary password.` };
  },
);

export const updateUserAction = defineAction(
  { permission: "user.manage", schema: updateUserSchema },
  async (input, actor) => {
    const user = await updateUser(actor, input);
    refresh();
    return { ok: true, message: `${user.name} updated.` };
  },
);

export const resetUserPasswordAction = defineAction(
  { permission: "user.manage", schema: resetPasswordSchema },
  async (input, actor) => {
    await resetUserPassword(actor, input);
    refresh();
    return { ok: true, message: "Password reset. Share the new temporary password with the user." };
  },
);
