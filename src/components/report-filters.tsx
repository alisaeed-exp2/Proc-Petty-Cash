import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localName } from "@/lib/names";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Filters } from "@/lib/reports";

/** GET filter form shared by the consumption history and the reports page. */
export async function ReportFilters({
  action,
  filters,
  showAgent,
  locale,
}: {
  action: "/consumption" | "/reports";
  filters: Filters;
  showAgent: boolean;
  locale: string;
}) {
  const r = await getTranslations("reports");
  const c = await getTranslations("common");
  const [agents, companies] = await Promise.all([
    showAgent
      ? prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.company.findMany({ orderBy: { code: "asc" } }),
  ]);
  return (
    <form method="get" className="mb-6 grid gap-3 rounded-card border border-line bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[repeat(4,1fr)_auto]">
      <div>
        <label className={labelCls} htmlFor="f-from">{c("from")}</label>
        <input id="f-from" name="from" type="date" defaultValue={filters.from ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="f-to">{c("to")}</label>
        <input id="f-to" name="to" type="date" defaultValue={filters.to ?? ""} className={inputCls} />
      </div>
      {showAgent ? (
        <div>
          <label className={labelCls} htmlFor="f-agent">{c("agent")}</label>
          <select id="f-agent" name="agentId" defaultValue={filters.agentId ?? ""} className={inputCls}>
            <option value="">{c("all")}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="hidden xl:block" />
      )}
      <div>
        <label className={labelCls} htmlFor="f-company">{c("company")}</label>
        <select id="f-company" name="companyId" defaultValue={filters.companyId ?? ""} className={inputCls}>
          <option value="">{c("all")}</option>
          {companies.map((co) => (
            <option key={co.id} value={co.id}>{localName(co, locale)}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" className={btnPrimary}>{c("filter")}</button>
        <Link href={action} className={btnSecondary}>{r("clear")}</Link>
      </div>
    </form>
  );
}

export function exportHref(report: string, locale: string, f: Filters): string {
  const p = new URLSearchParams({ lang: locale });
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.agentId) p.set("agentId", f.agentId);
  if (f.companyId) p.set("companyId", f.companyId);
  return `/api/export/${report}?${p.toString()}`;
}

export function pdfHref(report: string, locale: string, f: Filters): string {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.agentId) p.set("agentId", f.agentId);
  if (f.companyId) p.set("companyId", f.companyId);
  const qs = p.toString();
  return `/${locale}/print/${report}${qs ? `?${qs}` : ""}`;
}
