import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { can, type Permission, type Role } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  sessionToken: string;
};

// Reads the login cookie and loads the user fresh from the database.
// Wrapped in cache() so several components on one page share one lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    sessionToken: session.session.token,
  };
});

// For pages: sends visitors to the login page, users who must change their
// temporary password to the account page, and users without the permission
// back to the dashboard.
export async function requirePageUser(options: { permission?: Permission; allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowPasswordChange) redirect("/account?first=1");
  if (options.permission && !can(user.role, options.permission)) redirect("/?denied=1");
  return user;
}
