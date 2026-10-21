import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { can, type Permission } from "@/lib/permissions";
import { AppError } from "@/server/errors";
import { getCurrentUser, type CurrentUser } from "@/server/session";

export type ActionResult<T = void> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; details?: Record<string, string> };

// Every server action goes through this wrapper, which:
//  1. checks the user is signed in and active,
//  2. checks the permission for this action (server-side, never trusting the UI),
//  3. validates the input with a zod schema,
//  4. turns expected errors into friendly messages.
export function defineAction<S extends z.ZodType, T = void>(
  options: { permission: Permission | null; schema: S },
  handler: (input: z.output<S>, user: CurrentUser) => Promise<ActionResult<T>>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const user = await getCurrentUser();
      if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
      if (options.permission && !can(user.role, options.permission)) {
        return { ok: false, error: "You don't have permission to do that." };
      }
      const parsed = options.schema.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        return {
          ok: false,
          error: issues.length === 1 ? issues[0].message : "Please check the highlighted fields.",
          fieldErrors: fieldErrorsFrom(issues),
        };
      }
      return await handler(parsed.data, user);
    } catch (error) {
      unstable_rethrow(error); // let Next.js redirects pass through
      if (error instanceof AppError) {
        return { ok: false, error: error.message, fieldErrors: error.fieldErrors, details: error.details };
      }
      console.error(error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  };
}

// Requests wrap a product or sale form in { product: {...} } / { sale: {...} };
// report those fields by their own name so the form can show them in place.
const WRAPPERS = new Set(["product", "sale"]);

function fieldErrorsFrom(issues: z.core.$ZodIssue[]) {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path.map(String);
    const key = (WRAPPERS.has(path[0]) && path.length > 1 ? path[1] : path[0]) ?? "_form";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}
