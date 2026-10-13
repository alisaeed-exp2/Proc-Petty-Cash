import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { companyName, requireCompany } from "@/lib/company";
import { REPORTS, buildReport, type Cell, type Col, type Filters, type ReportKey } from "@/lib/reports";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/print-button";
import { Link } from "@/i18n/navigation";

function show(value: Cell | undefined, col: Col, locale: string): string {
  if (value === null || value === undefined || value === "") return "";
  switch (col.kind) {
    case "money":
      return typeof value === "number" ? formatHalalas(Math.round(value * 100)) : String(value);
    case "date":
      return value instanceof Date ? formatDate(value, locale) : String(value);
    case "percent":
      return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : String(value);
    default:
      return String(value);
  }
}

export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; report: string }>;
  searchParams: Promise<Filters>;
}) {
  const { locale, report } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);
  if (!(REPORTS as readonly string[]).includes(report)) notFound();
  const key = report as ReportKey;
  const { user, company } = await requireCompany(locale, ["MANAGER", "CONTROLLER", "AGENT"]);

  const r = await getTranslations("reports");
  const x = await getTranslations("expenses");
  const data = await buildReport(
    key,
    { role: user.role, userId: user.id, companyId: company.id },
    { from: filters.from, to: filters.to, agentId: filters.agentId },
    locale,
    { yes: r("yes"), type: (k) => r(`types.${k}`), status: (k) => x(`status.${k}`) },
  );

  const signatories = await prisma.companySignatory.findMany({
    where: { companyId: company.id },
    orderBy: [{ sort: "asc" }, { id: "asc" }],
  });

  const period = filters.from || filters.to ? `${filters.from ?? "…"} → ${filters.to ?? "…"}` : r("allDates");
  const totals = data.sumKeys.length > 0 && data.rows.length > 0;
  const sum = (k: string) => data.rows.reduce((n, row) => n + (typeof row[k] === "number" ? (row[k] as number) : 0), 0);

  return (
    <div className="mx-auto max-w-[1200px] bg-white p-6 text-ink print:p-0">
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          tr { break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-offwhite-50 p-3">
        <Link href="/reports" className="text-sm text-ocean underline underline-offset-4">{r("back")}</Link>
        <p className="text-xs text-muted">{r("pdfHint")}</p>
        <PrintButton />
      </div>

      <header className="mb-5 flex items-start justify-between gap-4 border-b-2 border-ocean pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={locale === "ar" ? "/brand/logo-ar.svg" : "/brand/logo-en.svg"} alt="" className="h-14 w-auto" />
        <div className="text-end">
          <h1 className="font-display text-2xl font-semibold text-ocean">{r(`names.${key}`)}</h1>
          <p className="text-sm font-medium">{companyName(company, locale)}</p>
          <p className="mt-1 text-xs text-muted">
            {r("generated")}: {formatDate(new Date(), locale)} · {r("period")}: <span className="num">{period}</span> · {r("currencyNote")}
          </p>
          <p className="text-xs text-muted">{user.name} · {r("rowsCount", { count: data.rows.length })}</p>
        </div>
      </header>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {data.cols.map((c) => (
              <th key={c.key} className="border border-ocean bg-ocean px-2 py-1.5 text-center font-semibold text-white">
                {r(`cols.${c.key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className={i % 2 ? "bg-offwhite-50" : ""}>
              {data.cols.map((c) => (
                <td
                  key={c.key}
                  className={`border border-line px-2 py-1 ${c.kind === "text" ? "text-start" : "num text-center"}`}
                >
                  {show(row[c.key], c, locale)}
                </td>
              ))}
            </tr>
          ))}
          {totals && (
            <tr className="bg-offwhite font-semibold text-ocean">
              {data.cols.map((c, i) => (
                <td key={c.key} className={`border border-line px-2 py-1.5 ${c.kind === "text" ? "text-start" : "num text-center"}`}>
                  {i === 0 ? r("totals") : data.sumKeys.includes(c.key) ? show(Math.round(sum(c.key) * 100) / 100, c, locale) : ""}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
      {signatories.length > 0 && (
        <footer dir="ltr" className="mt-16 break-inside-avoid">
          <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${signatories.length}, minmax(0, 1fr))` }}>
            {signatories.map((sg) => (
              <div key={sg.id} className="text-center">
                <div className="mx-auto mb-2 h-12 w-4/5 border-b border-ink" />
                <div className="text-sm font-semibold">{sg.positionEn}</div>
                <div dir="rtl" className="text-sm">{sg.positionAr}</div>
              </div>
            ))}
          </div>
        </footer>
      )}
      {data.rows.length === 0 && <p className="mt-6 text-center text-sm text-muted">{r("empty")}</p>}
    </div>
  );
}
