import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { localName } from "@/lib/names";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDateTime } from "@/lib/format";
import { Card, Empty, Notice, PageHeader, btnSecondary } from "@/components/ui";
import { BulkQueue } from "@/components/bulk-queue";
import { Link } from "@/i18n/navigation";
import { bulkApproveAction } from "./actions";

const DONE = ["rejected", "approved", "bulk"] as const;

export default async function ReviewQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string; done?: string; n?: string; skipped?: string }>;
}) {
  const { locale } = await params;
  const { filter, done, n, skipped } = await searchParams;
  setRequestLocale(locale);
  const me = await requireUser(locale, ["CONTROLLER", "MANAGER"]);
  const t = await getTranslations("review");
  const isManager = me.role === "MANAGER";
  const isAdmin = me.role === "SYSTEM_ADMIN";

  const flagWhere =
    filter === "overspend" ? { overspendFlag: true } : filter === "duplicate" ? { duplicateFlag: true } : {};
  const items = await prisma.expense.findMany({
    where: {
      status: isAdmin ? { in: ["SUBMITTED", "CONTROLLER_APPROVED"] } : isManager ? "CONTROLLER_APPROVED" : "SUBMITTED",
      ...flagWhere,
    },
    orderBy: { submittedAt: "asc" },
    include: {
      agent: { select: { name: true } },
      company: true,
      project: true,
      reviews: { where: { stage: "CONTROLLER", decision: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 1, include: { reviewer: { select: { name: true } } } },
    },
  });

  const filters = [
    { key: "all", href: "/review" },
    { key: "overspend", href: "/review?filter=overspend" },
    { key: "duplicate", href: "/review?filter=duplicate" },
  ];
  const doneKey = (DONE as readonly string[]).includes(done ?? "") ? done : null;

  return (
    <>
      <PageHeader title={isManager ? t("titleManager") : isAdmin ? t("titleAdmin") : t("title")} subtitle={isManager ? t("subtitleManager") : isAdmin ? t("subtitleAdmin") : t("subtitle")} />
      {doneKey && (
        <div className="mb-4">
          <Notice tone="good">{t(`done.${doneKey}`, { n: n ?? "0", skipped: skipped ?? "0" })}</Notice>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = (filter ?? "all") === f.key;
          return (
            <Link
              key={f.key}
              href={f.href}
              className={`${btnSecondary} !px-3 !py-1.5 !text-xs ${active ? "!border-ocean !bg-ocean-10" : ""}`}
              aria-current={active ? "true" : undefined}
            >
              {t(`filters.${f.key}`)}
            </Link>
          );
        })}
      </div>

      <Card>
        {items.length === 0 ? (
          <Empty>{t("empty")}</Empty>
        ) : (
          <BulkQueue
            action={bulkApproveAction}
            locale={locale}
            showApprover={isManager || isAdmin}
            rows={items.map((e) => ({
              id: e.id,
              submitted: formatDateTime(e.submittedAt, locale),
              agent: e.agent.name,
              vendor: e.vendorName ?? "-",
              company: localName(e.company, locale),
              project: e.project ? localName(e.project, locale) : null,
              total: e.total === null ? "-" : formatHalalas(e.total),
              overspend: e.overspendFlag,
              duplicate: e.duplicateFlag,
              selectable: e.agentId !== me.id && e.total !== null && e.total > 0,
              controllerApprover: e.reviews[0]?.reviewer.name ?? null,
            }))}
          />
        )}
      </Card>
    </>
  );
}
