import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { type AppUser } from "@/lib/session";
import { requireCompany } from "@/lib/company";
import { localName } from "@/lib/names";
import { getAgentBalance, getAllAgentBalances, getManagerSummary } from "@/lib/ledger/db";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate, monthKey } from "@/lib/format";
import { Badge, Card, Empty, Notice, PageHeader, ProgressBar, Stat, Table, btnPrimary, btnSecondary, td, tdNum, th, thNum } from "@/components/ui";
import { BarList, MonthBars } from "@/components/charts";
import { Link } from "@/i18n/navigation";

type T = (key: string, values?: Record<string, string | number>) => string;

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user, company } = await requireCompany(locale);
  const t = await getTranslations("dash");
  const c = await getTranslations("common");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("welcome", { name: user.name })} />
      {user.role === "AGENT" && <AgentDashboard user={user} companyId={company.id} locale={locale} t={t} c={c} />}
      {(user.role === "MANAGER" || user.role === "SYSTEM_ADMIN") && <ManagerDashboard companyId={company.id} locale={locale} t={t} c={c} />}
      {user.role === "GROUP_VP" && <ManagerDashboard companyId={company.id} locale={locale} t={t} c={c} readOnly />}
      {user.role === "CONTROLLER" && <ControllerDashboard companyId={company.id} locale={locale} t={t} c={c} />}
    </>
  );
}

async function AgentDashboard({ user, companyId, locale, t, c }: { user: AppUser; companyId: string; locale: string; t: T; c: T }) {
  const x = await getTranslations("expenses");
  const [bal, recent, counts] = await Promise.all([
    getAgentBalance(companyId, user.id),
    prisma.expense.findMany({ where: { agentId: user.id, companyId }, orderBy: { createdAt: "desc" }, take: 6, include: { company: true } }),
    prisma.expense.groupBy({ by: ["status"], where: { agentId: user.id, companyId }, _count: true }),
  ]);
  const count = (s: string) =>
    s === "SUBMITTED"
      ? counts.filter((r) => r.status === "SUBMITTED" || r.status === "CONTROLLER_APPROVED").reduce((n, r) => n + r._count, 0)
      : (counts.find((r) => r.status === s)?._count ?? 0);

  return (
    <>
      {bal.unresolved > 0 && (
        <div className="mb-4">
          <Notice tone="warn">{t("agent.unresolvedNote", { amount: formatHalalas(bal.unresolved), count: count("REJECTED") })}</Notice>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("allocated")} value={formatHalalas(bal.netAllocated)} unit={c("currency")} hint={bal.returned > 0 ? t("agent.returnedHint", { amount: formatHalalas(bal.returned) }) : undefined} />
        <Stat label={t("consumed")} value={formatHalalas(bal.consumed)} unit={c("currency")} hint={`${bal.percentConsumed}% ${t("ofAllocation")}`} />
        <Stat label={t("residual")} value={formatHalalas(bal.cashOnHand)} unit={c("currency")} tone={bal.cashOnHand < 0 ? "bad" : "default"} />
        <Stat label={t("available")} value={formatHalalas(bal.available)} unit={c("currency")} tone={bal.available < 0 ? "bad" : "good"} hint={t("availableHint")} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card title={t("consumption")}>
          <ProgressBar percent={bal.percentConsumed} />
          <div className="mt-2 flex justify-between text-sm">
            <span className="num font-semibold">{bal.percentConsumed}%</span>
            <span className="text-muted">
              {t("pending")}: <span className="num">{formatHalalas(bal.pending)}</span> · {t("unresolved")}: <span className="num">{formatHalalas(bal.unresolved)}</span>
            </span>
          </div>
        </Card>
        <Card title={t("agent.myInvoices")}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {(["SUBMITTED", "APPROVED", "REJECTED", "DRAFT"] as const).map((s) => (
              <div key={s}>
                <dt className="text-muted">{x(`status.${s}`)}</dt>
                <dd className="num font-display text-xl text-ocean">{count(s)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card
        title={t("agent.recent")}
        className="mt-6"
        actions={<Link href="/expenses/new" className={btnPrimary}>{x("newTitle")}</Link>}
      >
        {recent.length === 0 ? (
          <Empty>{x("empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{x("invoiceDate")}</th>
                <th className={th}>{x("vendor")}</th>
                <th className={th}>{c("company")}</th>
                <th className={thNum}>{x("total")}</th>
                <th className={th}>{c("status")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.id}>
                  <td className={td}>{formatDate(e.invoiceDate ?? e.createdAt, locale)}</td>
                  <td className={td}>{e.vendorName ?? "-"}</td>
                  <td className={td}>{localName(e.company, locale)}</td>
                  <td className={tdNum}>{e.total === null ? "-" : formatHalalas(e.total)}</td>
                  <td className={td}><Badge tone={e.status}>{x(`status.${e.status}`)}</Badge></td>
                  <td className={td}>
                    <Link href={`/expenses/${e.id}`} className="text-sm text-ocean underline underline-offset-4">{c("view")}</Link>
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

async function ManagerDashboard({ companyId, locale, t, c, readOnly = false }: { companyId: string; locale: string; t: T; c: T; readOnly?: boolean }) {
  const [summary, agents, pendingFlags, awaitingMe, byProject, projects, expenseEntries] = await Promise.all([
    getManagerSummary(companyId),
    getAllAgentBalances(companyId),
    prisma.expense.groupBy({ by: ["overspendFlag", "duplicateFlag"], where: { companyId, status: { in: ["SUBMITTED", "CONTROLLER_APPROVED"] } }, _count: true }),
    prisma.expense.count({ where: { companyId, status: "CONTROLLER_APPROVED" } }),
    prisma.expense.groupBy({ by: ["projectId"], where: { companyId, status: "APPROVED" }, _sum: { total: true } }),
    prisma.project.findMany({ where: { companyId }, select: { id: true, nameEn: true, nameAr: true } }),
    prisma.ledgerEntry.findMany({
      where: { companyId, type: { in: ["EXPENSE", "ADJUSTMENT"] }, occurredAt: { gte: new Date(Date.now() - 200 * 24 * 3600 * 1000) } },
      select: { amount: true, occurredAt: true },
    }),
  ]);

  const flagged = pendingFlags.filter((r) => r.overspendFlag || r.duplicateFlag).reduce((n, r) => n + r._count, 0);
  const pendingCount = pendingFlags.reduce((n, r) => n + r._count, 0);

  // Last six months, oldest first.
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 15)));
  const monthTotals = new Map(months.map((m) => [m, 0]));
  for (const e of expenseEntries) {
    const k = monthKey(e.occurredAt);
    if (monthTotals.has(k)) monthTotals.set(k, (monthTotals.get(k) ?? 0) + e.amount);
  }

  const projectName = new Map(projects.map((p) => [p.id, localName(p, locale)]));
  const companyBars = byProject
    .map((r) => ({ label: r.projectId ? (projectName.get(r.projectId) ?? "-") : t("manager.noProject"), value: r._sum.total ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <>
      {!readOnly && awaitingMe > 0 && (
        <div className="mb-4">
          <Notice tone="info">
            {t("manager.awaitingNote", { count: awaitingMe })}{" "}
            <Link href="/review" className="font-medium underline underline-offset-4">{t("manager.openApprovals")}</Link>
          </Notice>
        </div>
      )}
      {flagged > 0 && (
        <div className="mb-4">
          <Notice tone="warn">{t("manager.flaggedNote", { count: flagged })}</Notice>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("manager.funded")} value={formatHalalas(summary.funded)} unit={c("currency")} />
        <Stat label={t("manager.allocated")} value={formatHalalas(summary.allocated - summary.returned)} unit={c("currency")} hint={`${summary.percentAllocated}% ${t("manager.ofFunded")}`} />
        <Stat label={t("manager.pool")} value={formatHalalas(summary.unallocatedPool)} unit={c("currency")} tone="gold" />
        <Stat label={t("consumed")} value={formatHalalas(summary.consumed)} unit={c("currency")} hint={`${summary.percentConsumed}% ${t("manager.ofFunded")}`} />
        <Stat label={t("pending")} value={formatHalalas(summary.pending)} unit={c("currency")} hint={t("manager.invoices", { count: pendingCount })} tone="warn" />
        <Stat label={t("unresolved")} value={formatHalalas(summary.unresolved)} unit={c("currency")} tone={summary.unresolved > 0 ? "bad" : "default"} />
        <Stat label={t("manager.residual")} value={formatHalalas(summary.allocated - summary.returned - summary.consumed)} unit={c("currency")} hint={t("manager.residualHint")} />
        <Stat label={t("manager.agents")} value={String(agents.filter((a) => a.active).length)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title={t("manager.monthly")}>
          <MonthBars items={months.map((m) => ({ label: m.slice(2), value: monthTotals.get(m) ?? 0 }))} />
        </Card>
        <Card title={t("manager.byProject")}>
          {companyBars.length === 0 ? <Empty>{t("manager.noData")}</Empty> : <BarList items={companyBars} unit={c("currency")} />}
        </Card>
      </div>

      <Card
        title={t("manager.byAgent")}
        className="mt-6"
        actions={readOnly ? undefined : <Link href="/allocations" className={btnSecondary}>{t("manager.manage")}</Link>}
      >
        {agents.length === 0 ? (
          <Empty>{t("manager.noAgents")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{c("agent")}</th>
                <th className={thNum}>{t("allocated")}</th>
                <th className={thNum}>{t("consumed")}</th>
                <th className={th}>{t("consumption")}</th>
                <th className={thNum}>{t("residual")}</th>
                <th className={thNum}>{t("pending")}</th>
                <th className={thNum}>{t("unresolved")}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.agentId}>
                  <td className={td}>{a.name}</td>
                  <td className={tdNum}>{formatHalalas(a.netAllocated)}</td>
                  <td className={tdNum}>{formatHalalas(a.consumed)}</td>
                  <td className={td}>
                    <div className="flex min-w-28 items-center gap-2">
                      <ProgressBar percent={a.percentConsumed} />
                      <span className="num text-xs">{a.percentConsumed}%</span>
                    </div>
                  </td>
                  <td className={tdNum}>{formatHalalas(a.cashOnHand)}</td>
                  <td className={tdNum}>{formatHalalas(a.pending)}</td>
                  <td className={tdNum}>{formatHalalas(a.unresolved)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

async function ControllerDashboard({ companyId, locale, t, c }: { companyId: string; locale: string; t: T; c: T }) {
  const x = await getTranslations("expenses");
  const [pending, oldest, approved, rejected, recent] = await Promise.all([
    prisma.expense.findMany({ where: { companyId, status: "SUBMITTED" }, select: { total: true, overspendFlag: true, duplicateFlag: true } }),
    prisma.expense.findFirst({ where: { companyId, status: "SUBMITTED" }, orderBy: { submittedAt: "asc" }, select: { submittedAt: true } }),
    prisma.expenseReview.count({ where: { decision: "APPROVED", expense: { companyId } } }),
    prisma.expenseReview.count({ where: { decision: "REJECTED", expense: { companyId } } }),
    prisma.expenseReview.findMany({
      where: { expense: { companyId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { expense: { select: { id: true, vendorName: true, total: true } }, reviewer: { select: { name: true } } },
    }),
  ]);
  const total = pending.reduce((n, p) => n + (p.total ?? 0), 0);
  const days = oldest?.submittedAt ? Math.floor((Date.now() - oldest.submittedAt.getTime()) / 86400000) : 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("controller.waiting")} value={String(pending.length)} tone="warn" hint={`${formatHalalas(total)} ${c("currency")}`} />
        <Stat label={t("controller.flagged")} value={String(pending.filter((p) => p.overspendFlag || p.duplicateFlag).length)} tone="gold" />
        <Stat label={t("controller.oldest")} value={oldest ? String(days) : "-"} unit={oldest ? t("controller.days") : undefined} />
        <Stat label={t("controller.decided")} value={`${approved} / ${rejected}`} hint={t("controller.approvedRejected")} />
      </div>
      <Card
        title={t("controller.recent")}
        className="mt-6"
        actions={<Link href="/review" className={btnPrimary}>{t("controller.openQueue")}</Link>}
      >
        {recent.length === 0 ? (
          <Empty>{t("manager.noData")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{c("date")}</th>
                <th className={th}>{x("vendor")}</th>
                <th className={thNum}>{x("total")}</th>
                <th className={th}>{c("status")}</th>
                <th className={th}>{t("controller.by")}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{formatDate(r.createdAt, locale)}</td>
                  <td className={td}>
                    <Link href={`/review/${r.expense.id}`} className="text-ocean underline underline-offset-4">{r.expense.vendorName ?? "-"}</Link>
                  </td>
                  <td className={tdNum}>{r.expense.total === null ? "-" : formatHalalas(r.expense.total)}</td>
                  <td className={td}><Badge tone={r.decision}>{x(`status.${r.decision}`)}</Badge></td>
                  <td className={td}>{r.reviewer.name}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

