import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { localName } from "@/lib/names";
import { ActionForm } from "@/components/action-form";
import { Link } from "@/i18n/navigation";
import { Badge, Card, Empty, PageHeader, btnSecondary, inputCls, labelCls } from "@/components/ui";
import {
  createProjectAction,
  toggleCompanyActiveAction,
  toggleProjectActiveAction,
  updateCompanyAction,
  updateProjectAction,
} from "../actions";

export default async function CompanyDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["MANAGER"]);
  const t = await getTranslations("admin");
  const c = await getTranslations("common");

  const company = await prisma.company.findUnique({
    where: { id },
    include: { projects: { orderBy: [{ active: "desc" }, { code: "asc" }] } },
  });
  if (!company) notFound();

  const small = `${btnSecondary} !px-3 !py-1.5 !text-xs`;

  return (
    <>
      <PageHeader
        title={`${company.code} · ${localName(company, locale)}`}
        subtitle={t("companies.detailSubtitle")}
        actions={
          <Link href="/admin/companies" className={btnSecondary}>
            {c("back")}
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("companies.edit")}>
          <ActionForm action={updateCompanyAction.bind(null, company.id)} namespace="admin.companies" submit={c("save")}>
            <div>
              <label className={labelCls} htmlFor="e-en">{t("companies.nameEn")}</label>
              <input id="e-en" name="nameEn" required defaultValue={company.nameEn} dir="ltr" className={`${inputCls} text-start`} />
            </div>
            <div>
              <label className={labelCls} htmlFor="e-ar">{t("companies.nameAr")}</label>
              <input id="e-ar" name="nameAr" required defaultValue={company.nameAr} dir="rtl" className={inputCls} />
            </div>
          </ActionForm>
          <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
            <Badge tone={company.active ? "APPROVED" : "DRAFT"}>{company.active ? c("active") : c("inactive")}</Badge>
            <ActionForm
              action={toggleCompanyActiveAction.bind(null, company.id)}
              namespace="admin.companies"
              submit={company.active ? t("companies.deactivate") : t("companies.activate")}
              className="space-y-0"
              buttonClassName={small}
            />
          </div>
          <p className="mt-3 text-xs text-muted">{t("companies.deactivateNote")}</p>
        </Card>

        <Card title={t("projects.new")}>
          <ActionForm action={createProjectAction.bind(null, company.id)} namespace="admin.companies" submit={c("create")} resetOnSuccess>
            <div>
              <label className={labelCls} htmlFor="p-code">{t("companies.code")}</label>
              <input id="p-code" name="code" required maxLength={20} dir="ltr" className={`${inputCls} text-start`} />
            </div>
            <div>
              <label className={labelCls} htmlFor="p-en">{t("companies.nameEn")}</label>
              <input id="p-en" name="nameEn" required dir="ltr" className={`${inputCls} text-start`} />
            </div>
            <div>
              <label className={labelCls} htmlFor="p-ar">{t("companies.nameAr")}</label>
              <input id="p-ar" name="nameAr" required dir="rtl" className={inputCls} />
            </div>
          </ActionForm>
        </Card>
      </div>

      <Card title={t("projects.title")} className="mt-6">
        {company.projects.length === 0 ? (
          <Empty>{t("projects.empty")}</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {company.projects.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3 lg:w-48">
                  <span className="num font-medium">{p.code}</span>
                  <Badge tone={p.active ? "APPROVED" : "DRAFT"}>{p.active ? c("active") : c("inactive")}</Badge>
                </div>
                <ActionForm
                  action={updateProjectAction.bind(null, p.id)}
                  namespace="admin.companies"
                  submit={c("save")}
                  className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  buttonClassName={small}
                >
                  <div>
                    <label className="text-xs text-muted" htmlFor={`pe-${p.id}`}>{t("companies.nameEn")}</label>
                    <input id={`pe-${p.id}`} name="nameEn" required defaultValue={p.nameEn} dir="ltr" className={`${inputCls} text-start`} />
                  </div>
                  <div>
                    <label className="text-xs text-muted" htmlFor={`pa-${p.id}`}>{t("companies.nameAr")}</label>
                    <input id={`pa-${p.id}`} name="nameAr" required defaultValue={p.nameAr} dir="rtl" className={inputCls} />
                  </div>
                </ActionForm>
                <ActionForm
                  action={toggleProjectActiveAction.bind(null, p.id)}
                  namespace="admin.companies"
                  submit={p.active ? t("companies.deactivate") : t("companies.activate")}
                  className="space-y-0"
                  buttonClassName={small}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
