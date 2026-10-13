import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { localName } from "@/lib/names";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate, toDateInput } from "@/lib/format";
import { Badge, Card, Notice, PageHeader, btnSecondary } from "@/components/ui";
import { ExpenseEditForm } from "@/components/expense-forms";
import { FileViewer, FlagBadges, ReviewHistory } from "@/components/expense-view";
import { Link } from "@/i18n/navigation";
import { DeleteDraftForm } from "@/components/delete-draft-form";
import { deleteDraftAction, saveExpenseAction } from "../actions";

const plain = (h: number | null) => (h === null ? "" : (h / 100).toFixed(2));

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/70 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium">{children}</dd>
    </div>
  );
}

export default async function ExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ ocr?: string }>;
}) {
  const { locale, id } = await params;
  const { ocr } = await searchParams;
  setRequestLocale(locale);
  const { user, company } = await requireCompany(locale, ["AGENT"]);
  const t = await getTranslations("expenses");
  const c = await getTranslations("common");

  const e = await prisma.expense.findFirst({
    where: { id, agentId: user.id, companyId: company.id },
    include: {
      company: true,
      project: true,
      files: { orderBy: { uploadedAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true } } } },
    },
  });
  if (!e) notFound();

  const editable = e.status === "DRAFT" || e.status === "REJECTED";
  const lastRejection = e.reviews.find((r) => r.decision === "REJECTED");

  let projects: { id: string; name: string }[] = [];
  if (editable) {
    const list = await prisma.project.findMany({
      where: { companyId: e.companyId, OR: [{ active: true }, { id: e.projectId ?? "" }] },
      orderBy: { code: "asc" },
    });
    projects = list.map((p) => ({ id: p.id, name: localName(p, locale) }));
  }

  return (
    <>
      <PageHeader
        title={e.vendorName || t("detailTitle")}
        subtitle={`${localName(e.company, locale)}${e.project ? " · " + localName(e.project, locale) : ""}`}
        actions={
          <>
            <Badge tone={e.status}>{t(`status.${e.status}`)}</Badge>
            <FlagBadges overspend={e.overspendFlag} duplicate={e.duplicateFlag} />
            <Link href="/expenses" className={btnSecondary}>{c("back")}</Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          {e.status === "REJECTED" && (
            <Notice tone="bad">
              <strong>{t("rejectedTitle")}</strong>
              {lastRejection?.reason && <span> {lastRejection.reason}</span>}
              <div className="mt-1 text-xs">{t("rejectedNote")}</div>
            </Notice>
          )}
          {e.status === "DRAFT" && ocr === "done" && <Notice tone="info">{t("ocrDone")}</Notice>}
          {e.status === "DRAFT" && ocr === "skipped" && <Notice tone="warn">{t("ocrSkipped")}</Notice>}
          {e.status === "DRAFT" && ocr === "failed" && <Notice tone="warn">{t("ocrFailed")}</Notice>}

          <Card title={t("details")}>
            {editable ? (
              <ExpenseEditForm
                action={saveExpenseAction.bind(null, e.id)}
                companyName={localName(e.company, locale)}
                projects={projects}
                locale={locale}
                rejected={e.status === "REJECTED"}
                values={{
                  companyId: e.companyId,
                  projectId: e.projectId,
                  vendorName: e.vendorName ?? "",
                  vendorVatNo: e.vendorVatNo ?? "",
                  invoiceNumber: e.invoiceNumber ?? "",
                  invoiceDate: toDateInput(e.invoiceDate),
                  subtotal: plain(e.subtotal),
                  vatAmount: plain(e.vatAmount),
                  total: plain(e.total),
                  notes: e.notes ?? "",
                }}
              />
            ) : (
              <dl>
                <Row label={t("vendor")}>{e.vendorName ?? "-"}</Row>
                <Row label={t("vatNo")}><span className="num">{e.vendorVatNo ?? "-"}</span></Row>
                <Row label={t("invoiceNo")}><span className="num">{e.invoiceNumber ?? "-"}</span></Row>
                <Row label={t("invoiceDate")}>{formatDate(e.invoiceDate, locale)}</Row>
                <Row label={t("subtotal")}><span className="num">{e.subtotal === null ? "-" : formatHalalas(e.subtotal)}</span></Row>
                <Row label={t("vat")}><span className="num">{e.vatAmount === null ? "-" : formatHalalas(e.vatAmount)}</span></Row>
                <Row label={t("total")}><span className="num">{e.total === null ? "-" : `${formatHalalas(e.total)} ${c("currency")}`}</span></Row>
                {e.notes && <Row label={c("notes")}>{e.notes}</Row>}
              </dl>
            )}
          </Card>

          {e.status === "DRAFT" && !e.submittedAt && (
            <Card>
              <DeleteDraftForm action={deleteDraftAction.bind(null, e.id)} locale={locale} />
            </Card>
          )}

          <ReviewHistory
            locale={locale}
            reviews={e.reviews.map((r) => ({ id: r.id, decision: r.decision, reason: r.reason, createdAt: r.createdAt, reviewerName: r.reviewer.name, stage: r.stage }))}
          />
        </div>

        <Card title={t("invoiceFiles")}>
          <FileViewer files={e.files.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, version: f.version }))} locale={locale} />
        </Card>
      </div>
    </>
  );
}
