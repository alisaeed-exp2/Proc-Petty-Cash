import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { localName } from "@/lib/names";
import { getAgentBalance } from "@/lib/ledger/db";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDate } from "@/lib/format";
import { Badge, Card, Notice, PageHeader, btnSecondary } from "@/components/ui";
import { FileViewer, FlagBadges, ReviewHistory } from "@/components/expense-view";
import { ReviewForm } from "@/components/review-form";
import { Link } from "@/i18n/navigation";
import { reviewAction } from "../actions";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/70 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium">{children}</dd>
    </div>
  );
}

export default async function ReviewDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireUser(locale, ["CONTROLLER", "MANAGER"]);
  const t = await getTranslations("review");
  const x = await getTranslations("expenses");
  const c = await getTranslations("common");

  const e = await prisma.expense.findUnique({
    where: { id },
    include: {
      agent: { select: { name: true } },
      company: true,
      project: true,
      files: { orderBy: { uploadedAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true } } } },
    },
  });
  if (!e || e.status === "DRAFT") notFound();

  const bal = await getAgentBalance(e.agentId);
  const myStatus = me.role === "MANAGER" ? "CONTROLLER_APPROVED" : "SUBMITTED";
  const canDecide = e.status === myStatus && e.agentId !== me.id;

  return (
    <>
      <PageHeader
        title={e.vendorName || x("detailTitle")}
        subtitle={`${e.agent.name} · ${localName(e.company, locale)}${e.project ? " · " + localName(e.project, locale) : ""}`}
        actions={
          <>
            <Badge tone={e.status}>{x(`status.${e.status}`)}</Badge>
            <FlagBadges overspend={e.overspendFlag} duplicate={e.duplicateFlag} />
            <Link href="/review" className={btnSecondary}>{c("back")}</Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={x("invoiceFiles")}>
          <FileViewer files={e.files.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, version: f.version }))} locale={locale} />
        </Card>

        <div className="space-y-6">
          {e.overspendFlag && <Notice tone="warn">{t("overspendNote", { available: formatHalalas(bal.available) })}</Notice>}
          {e.duplicateFlag && <Notice tone="warn">{t("duplicateNote")}</Notice>}

          <Card title={x("details")}>
            <dl>
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

          <Card title={t("agentPosition")}>
            <dl>
              <Row label={x("netAllocated")}><span className="num">{formatHalalas(bal.netAllocated)}</span></Row>
              <Row label={x("consumed")}><span className="num">{formatHalalas(bal.consumed)} ({bal.percentConsumed}%)</span></Row>
              <Row label={x("available")}><span className="num">{formatHalalas(bal.available)}</span></Row>
            </dl>
          </Card>

          {canDecide ? (
            <Card title={me.role === "MANAGER" ? t("decisionManager") : t("decision")}>
              <ReviewForm action={reviewAction.bind(null, e.id)} locale={locale} />
            </Card>
          ) : e.agentId === me.id ? (
            <Notice tone="warn">{t("errors.ownExpense")}</Notice>
          ) : null}

          <ReviewHistory
            locale={locale}
            reviews={e.reviews.map((r) => ({ id: r.id, decision: r.decision, reason: r.reason, createdAt: r.createdAt, reviewerName: r.reviewer.name, stage: r.stage }))}
          />
        </div>
      </div>
    </>
  );
}
