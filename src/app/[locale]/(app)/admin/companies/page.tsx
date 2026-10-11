import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { localName } from "@/lib/names";
import { ActionForm } from "@/components/action-form";
import { Link } from "@/i18n/navigation";
import { Badge, Card, Empty, PageHeader, Table, inputCls, labelCls, td, th } from "@/components/ui";
import { createCompanyAction } from "./actions";

export default async function CompaniesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["MANAGER"]);
  const t = await getTranslations("admin");
  const c = await getTranslations("common");

  const companies = await prisma.company.findMany({
    orderBy: [{ active: "desc" }, { code: "asc" }],
    include: { _count: { select: { projects: true } } },
  });

  return (
    <>
      <PageHeader title={t("companies.title")} subtitle={t("companies.subtitle")} />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          {companies.length === 0 ? (
            <Empty>{t("companies.empty")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>{t("companies.code")}</th>
                  <th className={th}>{c("name")}</th>
                  <th className={th}>{t("companies.projects")}</th>
                  <th className={th}>{c("status")}</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {companies.map((co) => (
                  <tr key={co.id}>
                    <td className={`${td} num`}>{co.code}</td>
                    <td className={td}>
                      <div className="font-medium">{localName(co, locale)}</div>
                      <div className="text-xs text-muted">{locale === "ar" ? co.nameEn : co.nameAr}</div>
                    </td>
                    <td className={`${td} num`}>{co._count.projects}</td>
                    <td className={td}>
                      <Badge tone={co.active ? "APPROVED" : "DRAFT"}>{co.active ? c("active") : c("inactive")}</Badge>
                    </td>
                    <td className={td}>
                      <Link href={`/admin/companies/${co.id}`} className="text-sm text-ocean underline underline-offset-4">
                        {t("companies.manage")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title={t("companies.new")}>
          <ActionForm action={createCompanyAction} namespace="admin.companies" submit={c("create")} resetOnSuccess>
            <div>
              <label className={labelCls} htmlFor="c-code">{t("companies.code")}</label>
              <input id="c-code" name="code" required maxLength={20} dir="ltr" className={`${inputCls} text-start`} />
            </div>
            <div>
              <label className={labelCls} htmlFor="c-en">{t("companies.nameEn")}</label>
              <input id="c-en" name="nameEn" required dir="ltr" className={`${inputCls} text-start`} />
            </div>
            <div>
              <label className={labelCls} htmlFor="c-ar">{t("companies.nameAr")}</label>
              <input id="c-ar" name="nameAr" required dir="rtl" className={inputCls} />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
