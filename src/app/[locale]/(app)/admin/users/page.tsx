import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { ActionForm } from "@/components/action-form";
import { CompanyCheckboxes } from "@/components/company-checkboxes";
import { Badge, Card, PageHeader, Table, btnSecondary, inputCls, labelCls, td, th } from "@/components/ui";
import { createUserAction, resetPasswordAction, toggleUserActiveAction } from "./actions";

export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireUser(locale, ["MANAGER"]);
  const t = await getTranslations("admin");
  const roles = await getTranslations("roles");
  const c = await getTranslations("common");

  const [users, allCompanies] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
      include: { companies: { include: { company: { select: { code: true } } } } },
    }),
    prisma.company.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);
  const x = await getTranslations("ctx");

  return (
    <>
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <Table>
            <thead>
              <tr>
                <th className={th}>{c("name")}</th>
                <th className={th}>{c("email")}</th>
                <th className={th}>{t("users.role")}</th>
                <th className={th}>{x("userCompanies")}</th>
                <th className={th}>{c("status")}</th>
                <th className={th}>{t("users.created")}</th>
                <th className={th}>{c("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-ocean underline underline-offset-4">{u.name}</Link>
                    {u.mustChangePassword && <div className="text-xs text-status-pending">{t("users.mustChange")}</div>}
                  </td>
                  <td className={`${td} num`} dir="ltr">{u.email}</td>
                  <td className={td}>{roles(u.role)}</td>
                  <td className={`${td} text-xs`}>
                    {u.role === "SYSTEM_ADMIN" || u.role === "GROUP_VP" ? x("all") : u.companies.map((m) => m.company.code).join(", ") || "-"}
                  </td>
                  <td className={td}>
                    <Badge tone={u.active ? "APPROVED" : "DRAFT"}>{u.active ? c("active") : c("inactive")}</Badge>
                  </td>
                  <td className={td}>{formatDate(u.createdAt, locale)}</td>
                  <td className={td}>
                    <div className="flex flex-col gap-2">
                      <ActionForm
                        action={resetPasswordAction.bind(null, u.id)}
                        namespace="admin.users"
                        submit={t("users.reset")}
                        className="space-y-2"
                        buttonClassName={`${btnSecondary} !px-3 !py-1.5 !text-xs`}
                      />
                      {u.id !== me.id && (
                        <ActionForm
                          action={toggleUserActiveAction.bind(null, u.id)}
                          namespace="admin.users"
                          submit={u.active ? t("users.deactivate") : t("users.activate")}
                          className="space-y-2"
                          buttonClassName={`${btnSecondary} !px-3 !py-1.5 !text-xs`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title={t("users.new")}>
          <ActionForm action={createUserAction} namespace="admin.users" submit={c("create")} resetOnSuccess>
            <div>
              <label className={labelCls} htmlFor="u-name">{c("name")}</label>
              <input id="u-name" name="name" required minLength={2} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="u-email">{c("email")}</label>
              <input id="u-email" name="email" type="email" required dir="ltr" className={`${inputCls} text-start`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="u-role">{t("users.role")}</label>
                <select id="u-role" name="role" defaultValue="AGENT" className={inputCls}>
                  <option value="AGENT">{roles("AGENT")}</option>
                  <option value="CONTROLLER">{roles("CONTROLLER")}</option>
                  <option value="MANAGER">{roles("MANAGER")}</option>
                  <option value="GROUP_VP">{roles("GROUP_VP")}</option>
                  <option value="SYSTEM_ADMIN">{roles("SYSTEM_ADMIN")}</option>
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="u-locale">{t("users.language")}</label>
                <select id="u-locale" name="locale" defaultValue={locale === "ar" ? "ar" : "en"} className={inputCls}>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
            <fieldset>
              <legend className={labelCls}>{x("userCompanies")}</legend>
              {allCompanies.length === 0 ? (
                <p className="text-xs text-muted">{x("noCompanyYet")}</p>
              ) : (
                <CompanyCheckboxes companies={allCompanies} locale={locale} />
              )}
              <p className="mt-1 text-xs text-muted">{x("userCompaniesHint")}</p>
            </fieldset>
            <p className="text-xs text-muted">{t("users.tempNote")}</p>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
