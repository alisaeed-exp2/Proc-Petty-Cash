import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getAllAgentBalances, getManagerSummary } from "@/lib/ledger/db";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate, toDateInput } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, PageHeader, ProgressBar, Stat, Table, inputCls, labelCls, td, tdNum, th, thNum } from "@/components/ui";
import { allocateAction, returnCashAction } from "./actions";

export default async function AllocationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["MANAGER"]);
  const t = await getTranslations("allocations");
  const c = await getTranslations("common");

  const [summary, balances, allocations, returns] = await Promise.all([
    getManagerSummary(),
    getAllAgentBalances(),
    prisma.allocation.findMany({ orderBy: { allocatedAt: "desc" }, take: 50, include: { agent: { select: { name: true } } } }),
    prisma.cashReturn.findMany({ orderBy: { returnedAt: "desc" }, take: 50, include: { agent: { select: { name: true } } } }),
  ]);

  const movements = [
    ...allocations.map((a) => ({ id: a.id, kind: "ALLOCATION" as const, date: a.allocatedAt, agent: a.agent.name, amount: a.amount, notes: a.notes })),
    ...returns.map((r) => ({ id: r.id, kind: "RETURN" as const, date: r.returnedAt, agent: r.agent.name, amount: r.amount, notes: r.notes })),
  ]
    .sort((x, y) => y.date.getTime() - x.date.getTime())
    .slice(0, 60);

  const activeAgents = balances.filter((b) => b.active);
  const today = toDateInput(new Date());

  const agentSelect = (id: string) => (
    <select id={id} name="agentId" required className={inputCls} defaultValue="">
      <option value="" disabled>{t("chooseAgent")}</option>
      {activeAgents.map((a) => (
        <option key={a.agentId} value={a.agentId}>{a.name}</option>
      ))}
    </select>
  );

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("pool")} value={formatHalalas(summary.unallocatedPool)} unit={c("currency")} tone="gold" />
        <Stat label={t("netAllocated")} value={formatHalalas(summary.allocated - summary.returned)} unit={c("currency")} />
        <Stat label={t("consumed")} value={formatHalalas(summary.consumed)} unit={c("currency")} hint={`${summary.percentConsumed}%`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title={t("agents")}>
            {balances.length === 0 ? (
              <Empty>{t("noAgents")}</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>{c("agent")}</th>
                    <th className={thNum}>{t("netAllocated")}</th>
                    <th className={thNum}>{t("consumed")}</th>
                    <th className={th}>{t("percent")}</th>
                    <th className={thNum}>{t("cashOnHand")}</th>
                    <th className={thNum}>{t("pending")}</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.agentId}>
                      <td className={td}>
                        {b.name} {!b.active && <Badge tone="DRAFT">{c("inactive")}</Badge>}
                      </td>
                      <td className={tdNum}>{formatHalalas(b.netAllocated)}</td>
                      <td className={tdNum}>{formatHalalas(b.consumed)}</td>
                      <td className={td}>
                        <div className="flex min-w-28 items-center gap-2">
                          <ProgressBar percent={b.percentConsumed} />
                          <span className="num text-xs">{b.percentConsumed}%</span>
                        </div>
                      </td>
                      <td className={tdNum}>{formatHalalas(b.cashOnHand)}</td>
                      <td className={tdNum}>{formatHalalas(b.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title={t("movements")}>
            {movements.length === 0 ? (
              <Empty>{t("empty")}</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>{c("date")}</th>
                    <th className={th}>{t("type")}</th>
                    <th className={th}>{c("agent")}</th>
                    <th className={thNum}>{c("amount")}</th>
                    <th className={th}>{c("notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.kind + m.id}>
                      <td className={td}>{formatDate(m.date, locale)}</td>
                      <td className={td}>
                        <Badge tone={m.kind === "ALLOCATION" ? "APPROVED" : "FLAG"}>{t(`kind.${m.kind}`)}</Badge>
                      </td>
                      <td className={td}>{m.agent}</td>
                      <td className={tdNum}>{formatHalalas(m.amount)}</td>
                      <td className={td}>{m.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={t("allocateTitle")}>
            <ActionForm action={allocateAction} namespace="allocations" submit={t("allocate")} resetOnSuccess>
              <div>
                <label className={labelCls} htmlFor="a-agent">{c("agent")}</label>
                {agentSelect("a-agent")}
              </div>
              <div>
                <label className={labelCls} htmlFor="a-amount">{c("amount")} ({c("currency")})</label>
                <input id="a-amount" name="amount" required inputMode="decimal" dir="ltr" placeholder="0.00" className={`${inputCls} text-start`} />
              </div>
              <div>
                <label className={labelCls} htmlFor="a-date">{c("date")}</label>
                <input id="a-date" name="date" type="date" required defaultValue={today} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="a-notes">{c("notes")} ({c("optional")})</label>
                <input id="a-notes" name="notes" maxLength={500} className={inputCls} />
              </div>
            </ActionForm>
          </Card>

          <Card title={t("returnTitle")}>
            <p className="mb-3 text-xs text-muted">{t("returnNote")}</p>
            <ActionForm action={returnCashAction} namespace="allocations" submit={t("recordReturn")} resetOnSuccess>
              <div>
                <label className={labelCls} htmlFor="r-agent">{c("agent")}</label>
                {agentSelect("r-agent")}
              </div>
              <div>
                <label className={labelCls} htmlFor="r-amount">{c("amount")} ({c("currency")})</label>
                <input id="r-amount" name="amount" required inputMode="decimal" dir="ltr" placeholder="0.00" className={`${inputCls} text-start`} />
              </div>
              <div>
                <label className={labelCls} htmlFor="r-date">{c("date")}</label>
                <input id="r-date" name="date" type="date" required defaultValue={today} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="r-notes">{c("notes")} ({c("optional")})</label>
                <input id="r-notes" name="notes" maxLength={500} className={inputCls} />
              </div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
