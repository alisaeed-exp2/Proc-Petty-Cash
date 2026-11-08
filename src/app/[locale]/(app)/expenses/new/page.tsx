import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { companyName, requireCompany } from "@/lib/company";
import { localName } from "@/lib/names";
import { Card, Notice, PageHeader } from "@/components/ui";
import { NewExpenseForm } from "@/components/expense-forms";
import { storageConfigured } from "@/lib/storage";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate } from "@/lib/format";
import { createExpenseAction, readInvoiceAction } from "../actions";

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ refund?: string; of?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const refund = sp.refund === "1";
  setRequestLocale(locale);
  const { user, company } = await requireCompany(locale, ["AGENT"]);
  const t = await getTranslations("expenses");

  const projects = (
    await prisma.project.findMany({ where: { companyId: company.id, active: true }, orderBy: { code: "asc" } })
  ).map((p) => ({ id: p.id, name: localName(p, locale) }));

  const types = (await prisma.invoiceType.findMany({ where: { active: true }, orderBy: { code: "asc" } })).map((x) => ({ id: x.id, name: localName(x, locale) }));

  // Approved invoices of this agent that a refund can be linked to.
  const originals = refund
    ? (
        await prisma.expense.findMany({
          where: { agentId: user.id, companyId: company.id, kind: "EXPENSE", status: "APPROVED" },
          orderBy: { invoiceDate: "desc" },
          take: 200,
          select: { id: true, vendorName: true, invoiceNumber: true, invoiceDate: true, total: true, invoiceTypeId: true, projectId: true },
        })
      ).map((o) => ({
        id: o.id,
        label: `${o.vendorName ?? "-"} · ${o.invoiceNumber ?? "-"} · ${o.total === null ? "-" : formatHalalas(o.total)} · ${formatDate(o.invoiceDate, locale)}`,
        typeId: o.invoiceTypeId,
        projectId: o.projectId,
      }))
    : [];

  return (
    <>
      <PageHeader title={refund ? t("refundTitle") : t("newTitle")} subtitle={refund ? t("refundSubtitle") : t("newSubtitle")} />
      <div className="max-w-3xl">
        {!(await storageConfigured()) && <div className="mb-4"><Notice tone="warn">{t("errors.storage")}</Notice></div>}
        <Card>
          <NewExpenseForm action={createExpenseAction} readAction={readInvoiceAction} companyName={companyName(company, locale)} projects={projects} types={types} locale={locale} kind={refund ? "REFUND" : "EXPENSE"} originals={originals} initialRefundOf={sp.of ?? ""} />
        </Card>
      </div>
    </>
  );
}
