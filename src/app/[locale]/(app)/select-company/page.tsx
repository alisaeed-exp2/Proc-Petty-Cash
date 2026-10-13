import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { companyName, getActiveCompany, getAllowedCompanies } from "@/lib/company";
import { Card, Notice, PageHeader } from "@/components/ui";
import { selectCompanyAction } from "./actions";

export default async function SelectCompanyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("ctx");

  const [allowed, active] = await Promise.all([getAllowedCompanies(user.id, user.role), getActiveCompany(user.id, user.role)]);

  return (
    <>
      <PageHeader title={t("chooseTitle")} subtitle={t("chooseSubtitle")} />
      {allowed.length === 0 ? (
        <Notice tone="warn">{t("none")}</Notice>
      ) : (
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          {allowed.map((c) => (
            <Card key={c.id}>
              <form action={selectCompanyAction} className="flex h-full flex-col justify-between gap-4">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="companyId" value={c.id} />
                <div>
                  <div className="num text-xs text-muted">{c.code}</div>
                  <div className="font-display text-lg font-semibold text-ocean">{companyName(c, locale)}</div>
                  <div className="text-sm text-muted">{locale === "ar" ? c.nameEn : c.nameAr}</div>
                </div>
                <button
                  type="submit"
                  className="rounded-control bg-ocean px-4 py-2 text-sm font-medium text-white hover:bg-ocean-75"
                >
                  {active?.id === c.id ? t("continueWith") : t("workIn")}
                </button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
