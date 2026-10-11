import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { localName } from "@/lib/names";
import { Card, Notice, PageHeader } from "@/components/ui";
import { NewExpenseForm } from "@/components/expense-forms";
import { storageConfigured } from "@/lib/storage";
import { createExpenseAction } from "../actions";

export default async function NewExpensePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["AGENT"]);
  const t = await getTranslations("expenses");

  const companies = await prisma.company.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    include: { projects: { where: { active: true }, orderBy: { code: "asc" } } },
  });
  const options = companies.map((co) => ({
    id: co.id,
    name: localName(co, locale),
    projects: co.projects.map((p) => ({ id: p.id, name: localName(p, locale) })),
  }));

  return (
    <>
      <PageHeader title={t("newTitle")} subtitle={t("newSubtitle")} />
      <div className="max-w-2xl">
        {!storageConfigured() && <div className="mb-4"><Notice tone="warn">{t("errors.storage")}</Notice></div>}
        {options.length === 0 ? (
          <Notice tone="warn">{t("noCompanies")}</Notice>
        ) : (
          <Card>
            <NewExpenseForm action={createExpenseAction} companies={options} locale={locale} />
          </Card>
        )}
      </div>
    </>
  );
}
