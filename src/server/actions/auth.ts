"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";
import { defineAction, type ActionResult } from "@/server/action";
import { AppError } from "@/server/errors";
import { changeOwnPassword, createFirstAdmin } from "@/server/users";
import { changeOwnPasswordSchema, setupSchema } from "@/lib/validation/users";

/** First-run setup. Works only while there are no users at all. */
export async function setupAction(raw: z.input<typeof setupSchema>): Promise<ActionResult> {
  const parsed = setupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  try {
    await createFirstAdmin(parsed.data);
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    console.error(error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  // Sign the new Admin straight in.
  await auth.api.signInEmail({
    body: { email: parsed.data.email, password: parsed.data.password },
    headers: await headers(),
  });
  redirect("/");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

export const changeOwnPasswordAction = defineAction(
  { permission: null, schema: changeOwnPasswordSchema },
  async (input, user) => {
    await changeOwnPassword(user, input);
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  },
);
