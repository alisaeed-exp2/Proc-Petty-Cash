import { cache } from "react";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { requireUser, getActionUser, type AppUser } from "@/lib/session";

export const COMPANY_COOKIE = "akcc_company";

export type ActiveCompany = { id: string; code: string; nameEn: string; nameAr: string };

const select = { id: true, code: true, nameEn: true, nameAr: true } as const;

/** System administrators and the Group VP work across all companies; everyone else needs an assignment. */
export function seesAllCompanies(role: Role): boolean {
  return role === "SYSTEM_ADMIN" || role === "GROUP_VP";
}

/** Active companies this user may work in. */
export const getAllowedCompanies = cache(async (userId: string, role: Role): Promise<ActiveCompany[]> => {
  if (seesAllCompanies(role)) {
    return prisma.company.findMany({ where: { active: true }, orderBy: { code: "asc" }, select });
  }
  return prisma.company.findMany({
    where: { active: true, members: { some: { userId } } },
    orderBy: { code: "asc" },
    select,
  });
});

/**
 * The company the user is currently working in: the one in their cookie if they are still
 * allowed to use it, otherwise their only company if they have exactly one, otherwise null.
 */
export const getActiveCompany = cache(async (userId: string, role: Role): Promise<ActiveCompany | null> => {
  const allowed = await getAllowedCompanies(userId, role);
  const wanted = (await cookies()).get(COMPANY_COOKIE)?.value;
  const match = allowed.find((c) => c.id === wanted);
  if (match) return match;
  return allowed.length === 1 ? allowed[0] : null;
});

/** For pages: signed-in user plus a selected company (sends them to the chooser if none). */
export async function requireCompany(
  locale: string,
  roles?: Role[],
): Promise<{ user: AppUser; company: ActiveCompany }> {
  const user = await requireUser(locale, roles);
  const company = await getActiveCompany(user.id, user.role);
  if (!company) return redirect({ href: "/select-company", locale });
  return { user, company };
}

/** For server actions: null when not allowed or no company is selected. */
export async function getActionContext(roles?: Role[]): Promise<{ user: AppUser; company: ActiveCompany } | null> {
  const user = await getActionUser(roles);
  if (!user) return null;
  const company = await getActiveCompany(user.id, user.role);
  return company ? { user, company } : null;
}

export async function rememberCompany(companyId: string) {
  (await cookies()).set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function companyName(c: { nameEn: string; nameAr: string }, locale: string): string {
  const primary = locale === "ar" ? c.nameAr : c.nameEn;
  return primary?.trim() ? primary : locale === "ar" ? c.nameEn : c.nameAr;
}
