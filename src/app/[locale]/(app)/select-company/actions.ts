"use server";

import { getActionUser } from "@/lib/session";
import { getAllowedCompanies, rememberCompany } from "@/lib/company";
import { redirect } from "@/i18n/navigation";

/** Switches the company the user is working in (must be one they are allowed to use). */
export async function selectCompanyAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const user = await getActionUser();
  if (!user) return redirect({ href: "/login", locale });
  const id = String(formData.get("companyId") ?? "");
  const allowed = await getAllowedCompanies(user.id, user.role);
  if (!allowed.some((c) => c.id === id)) return redirect({ href: "/select-company", locale });
  await rememberCompany(id);
  return redirect({ href: "/dashboard", locale });
}
