import { cache } from "react";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  locale: "en" | "ar";
  mustChangePassword: boolean;
};

/** Loads the signed-in user fresh from the database (role, active flag, forced password change). */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, locale: true, active: true, mustChangePassword: true },
  });
  if (!u || !u.active) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    locale: u.locale === "ar" ? "ar" : "en",
    mustChangePassword: u.mustChangePassword,
  };
});

/**
 * Guard for server pages and actions. Signed-out users go to /login, users who must
 * choose a new password go to the change-password page, and users without one of the
 * allowed roles go back to their dashboard.
 */
export async function requireUser(
  locale: string,
  roles?: Role[],
  opts?: { allowForcedChange?: boolean },
): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });
  if (user.mustChangePassword && !opts?.allowForcedChange) {
    return redirect({ href: "/account/password", locale });
  }
  if (roles && !roles.includes(user.role)) return redirect({ href: "/dashboard", locale });
  return user;
}

/** Same checks for server actions (no redirect: returns null when not allowed). */
export async function getActionUser(roles?: Role[]): Promise<AppUser | null> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return null;
  if (roles && !roles.includes(user.role)) return null;
  return user;
}
