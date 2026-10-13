import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { companyName, requireCompany } from "@/lib/company";
import { localName } from "@/lib/names";
import { Card, Notice, PageHeader } from "@/components/ui";
import { NewExpenseForm } from "@/components/expense-forms";
import { storageConfigured } from "@/lib/storage";
import { createExpenseAction } from "../actions";

export default async function NewExpensePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { company } = await requireCompany(locale, ["AGENT"]);
  const t = await getTranslations("expenses");

  const projects = (
    await prisma.project.findMany({ where: { companyId: company.id, active: true }, orderBy: { code: "asc" } })
  ).map((p) => ({ id: p.id, name: localName(p, locale) }));

  return (
    <>
      <PageHeader title={t("newTitle")} subtitle={t("newSubtitle")} />
      <div className="max-w-2xl">
        {!storageConfigured() && <div className="mb-4"><Notice tone="warn">{t("errors.storage")}</Notice></div>}
        <Card>
          <NewExpenseForm action={createExpenseAction} companyName={companyName(company, locale)} projects={projects} locale={locale} />
        </Card>
      </div>
    </>
  );
}
