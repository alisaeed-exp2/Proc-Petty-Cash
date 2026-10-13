import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ActionForm } from "@/components/action-form";
import { Link } from "@/i18n/navigation";
import { Card, PageHeader, btnSecondary, inputCls, labelCls } from "@/components/ui";
import { CompanyCheckboxes } from "@/components/company-checkboxes";
import { resetPasswordAction, setUserCompaniesAction, toggleUserActiveAction, updateUserAction } from "../actions";

export default async function EditUserPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireUser(locale, ["MANAGER"]);
  const t = await getTranslations("admin");
  const roles = await getTranslations("roles");
  const c = await getTranslations("common");

  const [u, allCompanies, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.userCompany.findMany({ where: { userId: id }, select: { companyId: true } }),
  ]);
  const x = await getTranslations("ctx");
  if (!u) notFound();
  const small = `${btnSecondary} !px-3 !py-1.5 !text-xs`;

  return (
    <>
      <PageHeader
        title={t("users.edit")}
        subtitle={t("users.editSubtitle")}
        actions={<Link href="/admin/users" className={btnSecondary}>{c("back")}</Link>}
      />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_16rem]">
        <Card>
          <ActionForm action={updateUserAction.bind(null, u.id)} namespace="admin.users" submit={t("users.save")}>
            <div>
              <label className={labelCls} htmlFor="u-name">{c("name")}</label>
              <input id="u-name" name="name" required minLength={2} defaultValue={u.name} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="u-email">{c("email")}</label>
              <input id="u-email" name="email" type="email" required dir="ltr" defaultValue={u.email} className={`${inputCls} text-start`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="u-role">{t("users.role")}</label>
                <select id="u-role" name="role" defaultValue={u.role} disabled={u.id === me.id && me.role !== "SYSTEM_ADMIN"} className={inputCls}>
                  <option value="AGENT">{roles("AGENT")}</option>
                  <option value="CONTROLLER">{roles("CONTROLLER")}</option>
                  <option value="MANAGER">{roles("MANAGER")}</option>
                  <option value="GROUP_VP">{roles("GROUP_VP")}</option>
                  <option value="SYSTEM_ADMIN">{roles("SYSTEM_ADMIN")}</option>
                </select>
                {u.id === me.id && me.role !== "SYSTEM_ADMIN" && <input type="hidden" name="role" value={u.role} />}
                {me.role === "SYSTEM_ADMIN" && <p className="mt-1 text-xs text-muted">{t("users.adminRoleNote")}</p>}
              </div>
              <div>
                <label className={labelCls} htmlFor="u-locale">{t("users.language")}</label>
                <select id="u-locale" name="locale" defaultValue={u.locale} className={inputCls}>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
          </ActionForm>
        </Card>
        <Card title={x("userCompanies")} className="lg:col-span-2">
          {u.role === "SYSTEM_ADMIN" || u.role === "GROUP_VP" ? (
            <p className="text-sm text-muted">{x("allCompaniesNote")}</p>
          ) : allCompanies.length === 0 ? (
            <p className="text-sm text-muted">{x("noCompanyYet")}</p>
          ) : (
            <ActionForm action={setUserCompaniesAction.bind(null, u.id)} namespace="ctx" submit={x("saveCompanies")}>
              <CompanyCheckboxes companies={allCompanies} selected={memberships.map((m) => m.companyId)} locale={locale} />
              <p className="text-xs text-muted">{x("userCompaniesHint")}</p>
            </ActionForm>
          )}
        </Card>
        <Card>
          <div className="space-y-3">
            <ActionForm action={resetPasswordAction.bind(null, u.id)} namespace="admin.users" submit={t("users.reset")} className="space-y-2" buttonClassName={small} />
            {u.id !== me.id && (
              <ActionForm
                action={toggleUserActiveAction.bind(null, u.id)}
                namespace="admin.users"
                submit={u.active ? t("users.deactivate") : t("users.activate")}
                className="space-y-2"
                buttonClassName={small}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
