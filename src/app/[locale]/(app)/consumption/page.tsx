import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { buildReport, type Filters } from "@/lib/reports";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate } from "@/lib/format";
import { Card, Empty, PageHeader, Stat, Table, btnSecondary, td, tdNum, th, thNum } from "@/components/ui";
import { ReportFilters, exportHref, pdfHref } from "@/components/report-filters";
import { FlagBadges } from "@/components/expense-view";
import { Link } from "@/i18n/navigation";

export default async function ConsumptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Filters>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["MANAGER", "CONTROLLER"]);
  const r = await getTranslations("reports");
  const x = await getTranslations("expenses");
  const c = await getTranslations("common");

  const data = await buildReport(
    "consumption",
    { role: user.role, userId: user.id },
    { from: filters.from, to: filters.to, agentId: filters.agentId, companyId: filters.companyId },
    locale,
    { yes: r("yes"), type: (k) => r(`types.${k}`), status: (k) => x(`status.${k}`) },
  );
  const total = data.rows.reduce((n, row) => n + (typeof row.total === "number" ? row.total : 0), 0);

  return (
    <>
      <PageHeader
        title={r("consumptionTitle")}
        subtitle={r("consumptionSubtitle")}
        actions={
          <>
            <a href={exportHref("consumption", locale, filters)} className={btnSecondary}>{r("downloadExcel")}</a>
            <a href={pdfHref("consumption", locale, filters)} target="_blank" rel="noreferrer" className={btnSecondary}>{r("downloadPdf")}</a>
          </>
        }
      />
      <ReportFilters action="/consumption" filters={filters} showAgent locale={locale} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label={r("count")} value={String(data.rows.length)} />
        <Stat label={r("cols.total")} value={formatHalalas(Math.round(total * 100))} unit={c("currency")} />
      </div>

      <Card>
        {data.rows.length === 0 ? (
          <Empty>{r("empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{r("cols.invoiceDate")}</th>
                <th className={th}>{r("cols.agent")}</th>
                <th className={th}>{r("cols.company")}</th>
                <th className={th}>{r("cols.vendor")}</th>
                <th className={th}>{r("cols.invoiceNo")}</th>
                <th className={thNum}>{r("cols.vat")}</th>
                <th className={thNum}>{r("cols.total")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i}>
                  <td className={td}>{formatDate(row.invoiceDate as Date | null, locale)}</td>
                  <td className={td}>{row.agent as string}</td>
                  <td className={td}>
                    {row.company as string}
                    {row.project ? <div className="text-xs text-muted">{row.project as string}</div> : null}
                  </td>
                  <td className={td}>{(row.vendor as string | null) ?? "-"}</td>
                  <td className={`${td} num`}>{(row.invoiceNo as string | null) ?? "-"}</td>
                  <td className={tdNum}>{typeof row.vat === "number" ? formatHalalas(Math.round(row.vat * 100)) : "-"}</td>
                  <td className={tdNum}>{typeof row.total === "number" ? formatHalalas(Math.round(row.total * 100)) : "-"}</td>
                  <td className={td}>
                    <FlagBadges overspend={!!row.overspend} duplicate={!!row.duplicate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        <Link href="/reports" className="underline underline-offset-4">{r("moreReports")}</Link>
      </p>
    </>
  );
}
