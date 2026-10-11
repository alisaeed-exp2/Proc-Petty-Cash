import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";

export type AppRole = "MANAGER" | "CONTROLLER" | "AGENT";

/**
 * Server-side guard for pages and server actions. Redirects to /login when signed
 * out, and to the dashboard when the user's role is not allowed.
 */
export async function requireRole(locale: string, allowed?: AppRole[]) {
  const session = await auth();
  if (!session?.user) redirect({ href: "/login", locale });
  const user = session!.user;
  if (allowed && !allowed.includes(user.role)) redirect({ href: "/dashboard", locale });
  return user;
}
