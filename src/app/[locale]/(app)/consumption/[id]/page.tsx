import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { localName } from "@/lib/names";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageHeader, btnSecondary } from "@/components/ui";
import { FileViewer, FlagBadges, ReviewHistory } from "@/components/expense-view";
import { Link } from "@/i18n/navigation";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/70 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium">{children}</dd>
    </div>
  );
}

/** Read-only view of one approved expense in the consumption history, with its uploaded invoice. */
export default async function ConsumptionDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { company } = await requireCompany(locale, ["MANAGER", "CONTROLLER"]);
  const x = await getTranslations("expenses");
  const c = await getTranslations("common");
  const r = await getTranslations("reports");

  const e = await prisma.expense.findUnique({
    where: { id },
    include: {
      agent: { select: { name: true } },
      company: true,
      project: true,
      invoiceType: true,
      files: { orderBy: { uploadedAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true } } } },
    },
  });
  if (!e || e.status !== "APPROVED" || e.companyId !== company.id) notFound();

  return (
    <>
      <PageHeader
        title={e.vendorName || x("detailTitle")}
        subtitle={`${e.agent.name} · ${localName(e.company, locale)}${e.project ? " · " + localName(e.project, locale) : ""}`}
        actions={
          <>
            <Badge tone={e.status}>{x(`status.${e.status}`)}</Badge>
            <FlagBadges overspend={e.overspendFlag} duplicate={e.duplicateFlag} />
            <Link href="/consumption" className={btnSecondary}>{r("backToConsumption")}</Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={x("invoiceFiles")}>
          <FileViewer files={e.files.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, version: f.version }))} locale={locale} />
        </Card>

        <div className="space-y-6">
          <Card title={x("details")}>
            <dl>
              <Row label={c("agent")}>{e.agent.name}</Row>
              <Row label={c("company")}>{localName(e.company, locale)}</Row>
              <Row label={c("project")}>{e.project ? localName(e.project, locale) : "-"}</Row>
              <Row label={x("invoiceType")}>{e.invoiceType ? localName(e.invoiceType, locale) : "-"}</Row>
              <Row label={x("vendor")}>{e.vendorName ?? "-"}</Row>
              <Row label={x("vatNo")}><span className="num">{e.vendorVatNo ?? "-"}</span></Row>
              <Row label={x("invoiceNo")}><span className="num">{e.invoiceNumber ?? "-"}</span></Row>
              <Row label={x("invoiceDate")}>{formatDate(e.invoiceDate, locale)}</Row>
              <Row label={x("subtotal")}><span className="num">{e.subtotal === null ? "-" : formatHalalas(e.subtotal)}</span></Row>
              <Row label={x("vat")}><span className="num">{e.vatAmount === null ? "-" : formatHalalas(e.vatAmount)}</span></Row>
              <Row label={x("total")}><span className="num">{e.total === null ? "-" : `${formatHalalas(e.total)} ${c("currency")}`}</span></Row>
              {e.notes && <Row label={c("notes")}>{e.notes}</Row>}
            </dl>
          </Card>

          <ReviewHistory
            locale={locale}
            reviews={e.reviews.map((rv) => ({ id: rv.id, decision: rv.decision, reason: rv.reason, createdAt: rv.createdAt, reviewerName: rv.reviewer.name, stage: rv.stage }))}
          />
        </div>
      </div>
    </>
  );
}
