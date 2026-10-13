import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { localName } from "@/lib/names";
import { getAgentBalance } from "@/lib/ledger/db";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate } from "@/lib/format";
import { Badge, Card, Empty, Notice, PageHeader, Stat, Table, btnPrimary, td, tdNum, th, thNum } from "@/components/ui";
import { FlagBadges } from "@/components/expense-view";
import { Link } from "@/i18n/navigation";

export default async function MyExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { locale } = await params;
  const { submitted } = await searchParams;
  setRequestLocale(locale);
  const { user, company } = await requireCompany(locale, ["AGENT"]);
  const t = await getTranslations("expenses");
  const c = await getTranslations("common");

  const [bal, expenses] = await Promise.all([
    getAgentBalance(company.id, user.id),
    prisma.expense.findMany({
      where: { agentId: user.id, companyId: company.id },
      orderBy: { createdAt: "desc" },
      include: { company: true, project: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={t("listTitle")}
        subtitle={t("listSubtitle")}
        actions={<Link href="/expenses/new" className={btnPrimary}>{t("newTitle")}</Link>}
      />
      {submitted && <div className="mb-4"><Notice tone="good">{t("info.submitted")}</Notice></div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("netAllocated")} value={formatHalalas(bal.netAllocated)} unit={c("currency")} />
        <Stat label={t("consumed")} value={formatHalalas(bal.consumed)} unit={c("currency")} hint={`${bal.percentConsumed}%`} />
        <Stat label={t("available")} value={formatHalalas(bal.available)} unit={c("currency")} tone={bal.available < 0 ? "bad" : "good"} />
        <Stat label={t("unresolved")} value={formatHalalas(bal.unresolved)} unit={c("currency")} tone={bal.unresolved > 0 ? "warn" : "default"} />
      </div>

      <Card>
        {expenses.length === 0 ? (
          <Empty>{t("empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("invoiceDate")}</th>
                <th className={th}>{t("vendor")}</th>
                <th className={th}>{c("company")}</th>
                <th className={thNum}>{t("total")}</th>
                <th className={th}>{c("status")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className={td}>{formatDate(e.invoiceDate ?? e.createdAt, locale)}</td>
                  <td className={td}>{e.vendorName ?? <span className="text-muted">{t("notRead")}</span>}</td>
                  <td className={td}>
                    {localName(e.company, locale)}
                    {e.project && <div className="text-xs text-muted">{localName(e.project, locale)}</div>}
                  </td>
                  <td className={tdNum}>{e.total === null ? "-" : formatHalalas(e.total)}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={e.status}>{t(`status.${e.status}`)}</Badge>
                      <FlagBadges overspend={e.overspendFlag} duplicate={e.duplicateFlag} />
                    </div>
                  </td>
                  <td className={td}>
                    <Link href={`/expenses/${e.id}`} className="text-sm text-ocean underline underline-offset-4">
                      {e.status === "DRAFT" || e.status === "REJECTED" ? t("continue") : c("view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
