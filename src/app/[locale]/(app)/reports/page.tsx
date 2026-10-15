import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCompany } from "@/lib/company";
import { REPORTS, type Filters } from "@/lib/reports";
import { Card, PageHeader, btnPrimary, btnSecondary } from "@/components/ui";
import { ReportFilters, exportHref, pdfHref } from "@/components/report-filters";

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
  const { user, company } = await requireCompany(locale, ["MANAGER", "CONTROLLER", "AGENT"]);
  const r = await getTranslations("reports");

  return (
    <>
      <PageHeader title={r("title")} subtitle={user.role === "AGENT" ? r("subtitleAgent") : r("subtitle")} />
      <ReportFilters action="/reports" filters={filters} showAgent={user.role !== "AGENT"} companyId={company.id} locale={locale} />
      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((key) => (
          <Card key={key} title={r(`names.${key}`)}>
            <p className="mb-4 text-sm text-muted">{r(`descriptions.${key}`)}</p>
            <div className="flex flex-wrap gap-3">
              <a href={exportHref(key, locale, filters)} className={btnPrimary}>
                {r("downloadExcel")}
              </a>
              <a href={pdfHref(key, locale, filters)} target="_blank" rel="noreferrer" className={btnSecondary}>
                {r("downloadPdf")}
              </a>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">{r("filterNote")}</p>
    </>
  );
}
