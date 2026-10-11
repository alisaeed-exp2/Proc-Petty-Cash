import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { REPORTS, type Filters } from "@/lib/reports";
import { Card, PageHeader, btnPrimary } from "@/components/ui";
import { ReportFilters, exportHref } from "@/components/report-filters";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Filters>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const r = await getTranslations("reports");

  return (
    <>
      <PageHeader title={r("title")} subtitle={user.role === "AGENT" ? r("subtitleAgent") : r("subtitle")} />
      <ReportFilters action="/reports" filters={filters} showAgent={user.role !== "AGENT"} locale={locale} />
      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((key) => (
          <Card key={key} title={r(`names.${key}`)}>
            <p className="mb-4 text-sm text-muted">{r(`descriptions.${key}`)}</p>
            <a href={exportHref(key, locale, filters)} className={btnPrimary}>
              {r("download")}
            </a>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">{r("filterNote")}</p>
    </>
  );
}
