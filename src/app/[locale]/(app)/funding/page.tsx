import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { getManagerSummary } from "@/lib/ledger/db";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate, toDateInput } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Card, Empty, PageHeader, Stat, Table, inputCls, labelCls, td, tdNum, th, thNum } from "@/components/ui";
import { recordFundingAction } from "./actions";

export default async function FundingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { company } = await requireCompany(locale, ["MANAGER"]);
  const t = await getTranslations("funding");
  const c = await getTranslations("common");

  const [summary, history] = await Promise.all([
    getManagerSummary(company.id),
    prisma.funding.findMany({
      where: { companyId: company.id },
      orderBy: { receivedAt: "desc" },
      take: 100,
      include: { recordedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("totalFunded")} value={formatHalalas(summary.funded)} unit={c("currency")} />
        <Stat label={t("allocated")} value={formatHalalas(summary.allocated - summary.returned)} unit={c("currency")} />
        <Stat label={t("pool")} value={formatHalalas(summary.unallocatedPool)} unit={c("currency")} tone="gold" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card title={t("history")}>
          {history.length === 0 ? (
            <Empty>{t("empty")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>{c("date")}</th>
                  <th className={th}>{t("reference")}</th>
                  <th className={thNum}>{c("amount")}</th>
                  <th className={th}>{t("recordedBy")}</th>
                  <th className={th}>{c("notes")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((f) => (
                  <tr key={f.id}>
                    <td className={td}>{formatDate(f.receivedAt, locale)}</td>
                    <td className={`${td} num`}>{f.reference ?? "-"}</td>
                    <td className={tdNum}>{formatHalalas(f.amount)}</td>
                    <td className={td}>{f.recordedBy.name}</td>
                    <td className={td}>{f.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title={t("new")}>
          <ActionForm action={recordFundingAction} namespace="funding" submit={t("record")} resetOnSuccess>
            <div>
              <label className={labelCls} htmlFor="f-amount">{c("amount")} ({c("currency")})</label>
              <input id="f-amount" name="amount" required inputMode="decimal" dir="ltr" placeholder="0.00" className={`${inputCls} text-start`} />
            </div>
            <div>
              <label className={labelCls} htmlFor="f-date">{t("receivedAt")}</label>
              <input id="f-date" name="receivedAt" type="date" required defaultValue={toDateInput(new Date())} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="f-ref">{t("reference")} ({c("optional")})</label>
              <input id="f-ref" name="reference" maxLength={120} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="f-notes">{c("notes")} ({c("optional")})</label>
              <textarea id="f-notes" name="notes" rows={2} maxLength={500} className={inputCls} />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
