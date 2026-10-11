import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ActionForm } from "@/components/action-form";
import { Link } from "@/i18n/navigation";
import { Card, PageHeader, btnSecondary, inputCls, labelCls } from "@/components/ui";
import { resetPasswordAction, toggleUserActiveAction, updateUserAction } from "../actions";

export default async function EditUserPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireUser(locale, ["MANAGER"]);
  const t = await getTranslations("admin");
  const roles = await getTranslations("roles");
  const c = await getTranslations("common");

  const u = await prisma.user.findUnique({ where: { id } });
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
                <select id="u-role" name="role" defaultValue={u.role} disabled={u.id === me.id} className={inputCls}>
                  <option value="AGENT">{roles("AGENT")}</option>
                  <option value="CONTROLLER">{roles("CONTROLLER")}</option>
                  <option value="MANAGER">{roles("MANAGER")}</option>
                  <option value="GROUP_VP">{roles("GROUP_VP")}</option>
                  <option value="SYSTEM_ADMIN">{roles("SYSTEM_ADMIN")}</option>
                </select>
                {u.id === me.id && <input type="hidden" name="role" value={u.role} />}
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
