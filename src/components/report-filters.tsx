import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Filters } from "@/lib/reports";

/** GET filter form shared by the consumption history and the reports page. */
export async function ReportFilters({
  action,
  filters,
  showAgent,
  companyId,
}: {
  action: "/consumption" | "/reports";
  filters: Filters;
  showAgent: boolean;
  companyId: string;
}) {
  const r = await getTranslations("reports");
  const c = await getTranslations("common");
  const agents = showAgent
    ? await prisma.user.findMany({
        where: { role: "AGENT", OR: [{ companies: { some: { companyId } } }, { ledgerEntries: { some: { companyId } } }] },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  return (
    <form method="get" className="mb-6 grid gap-3 rounded-card border border-line bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[repeat(3,1fr)_auto]">
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
  return `/api/export/${report}?${p.toString()}`;
}

export function pdfHref(report: string, locale: string, f: Filters): string {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.agentId) p.set("agentId", f.agentId);
  const qs = p.toString();
  return `/${locale}/print/${report}${qs ? `?${qs}` : ""}`;
}
