import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { localName } from "@/lib/names";
import { formatHalalas } from "@/lib/ledger/money";
import { formatDateTime } from "@/lib/format";
import { Card, Empty, Notice, PageHeader, Table, btnSecondary, td, tdNum, th, thNum } from "@/components/ui";
import { FlagBadges } from "@/components/expense-view";
import { Link } from "@/i18n/navigation";

export default async function ReviewQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string; done?: string }>;
}) {
  const { locale } = await params;
  const { filter, done } = await searchParams;
  setRequestLocale(locale);
  await requireUser(locale, ["CONTROLLER"]);
  const t = await getTranslations("review");

  const flagWhere =
    filter === "overspend" ? { overspendFlag: true } : filter === "duplicate" ? { duplicateFlag: true } : {};
  const items = await prisma.expense.findMany({
    where: { status: "SUBMITTED", ...flagWhere },
    orderBy: { submittedAt: "asc" },
    include: { agent: { select: { name: true } }, company: true, project: true },
  });

  const filters = [
    { key: "all", href: "/review" },
    { key: "overspend", href: "/review?filter=overspend" },
    { key: "duplicate", href: "/review?filter=duplicate" },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {done && <div className="mb-4"><Notice tone="good">{t(`done.${done === "approved" ? "approved" : "rejected"}`)}</Notice></div>}

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
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("submitted")}</th>
                <th className={th}>{t("agent")}</th>
                <th className={th}>{t("vendor")}</th>
                <th className={th}>{t("company")}</th>
                <th className={thNum}>{t("total")}</th>
                <th className={th}>{t("flags")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td className={td}>{formatDateTime(e.submittedAt, locale)}</td>
                  <td className={td}>{e.agent.name}</td>
                  <td className={td}>{e.vendorName ?? "-"}</td>
                  <td className={td}>
                    {localName(e.company, locale)}
                    {e.project && <div className="text-xs text-muted">{localName(e.project, locale)}</div>}
                  </td>
                  <td className={tdNum}>{e.total === null ? "-" : formatHalalas(e.total)}</td>
                  <td className={td}><FlagBadges overspend={e.overspendFlag} duplicate={e.duplicateFlag} /></td>
                  <td className={td}>
                    <Link href={`/review/${e.id}`} className="text-sm font-medium text-ocean underline underline-offset-4">
                      {t("open")}
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
