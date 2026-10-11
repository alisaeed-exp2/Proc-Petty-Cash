import { getTranslations } from "next-intl/server";
import { Badge, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export type ViewFile = { id: string; fileName: string; mimeType: string; version: number };

/** Shows the stored invoice files (latest version first) with a viewer for the newest one. */
export async function FileViewer({ files, locale }: { files: ViewFile[]; locale: string }) {
  const t = await getTranslations("expenses");
  if (files.length === 0) return <p className="text-sm text-muted">{t("noFiles")}</p>;
  const sorted = [...files].sort((a, b) => b.version - a.version);
  const current = sorted[0];
  const latest = sorted.filter((f) => f.version === current.version);
  const older = sorted.filter((f) => f.version !== current.version);
  void locale;
  return (
    <div className="space-y-3">
      {latest.map((f) => (
        <div key={f.id} className="overflow-hidden rounded-card border border-line bg-gray">
          {f.mimeType === "application/pdf" ? (
            <iframe src={`/api/files/${f.id}`} title={f.fileName} className="h-[34rem] w-full bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${f.id}`} alt={f.fileName} className="mx-auto max-h-[34rem] w-auto object-contain" />
          )}
          <div className="flex items-center justify-between gap-2 border-t border-line bg-white px-3 py-2 text-xs">
            <span className="num truncate" dir="ltr">{f.fileName}</span>
            <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="shrink-0 text-ocean underline underline-offset-4">
              {t("openFile")}
            </a>
          </div>
        </div>
      ))}
      {older.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">{t("earlierVersions", { count: older.length })}</summary>
          <ul className="mt-2 space-y-1">
            {older.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <Badge tone="DRAFT">{t("version", { n: f.version })}</Badge>
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="num truncate text-ocean underline underline-offset-4" dir="ltr">
                  {f.fileName}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export type ReviewItem = { id: string; decision: "APPROVED" | "REJECTED"; reason: string | null; createdAt: Date; reviewerName: string; stage: "CONTROLLER" | "MANAGER" };

export async function ReviewHistory({ reviews, locale }: { reviews: ReviewItem[]; locale: string }) {
  const t = await getTranslations("expenses");
  if (reviews.length === 0) return null;
  return (
    <Card title={t("reviewHistory")}>
      <ul className="space-y-3 text-sm">
        {reviews.map((r) => (
          <li key={r.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.decision}>{t(`status.${r.decision}`)}</Badge>
              <span className="text-xs text-muted">{t(`stage.${r.stage}`)}</span>
              <span className="font-medium">{r.reviewerName}</span>
              <span className="text-xs text-muted">{formatDateTime(r.createdAt, locale)}</span>
            </div>
            {r.reason && <p className="mt-1 text-ink">{r.reason}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export async function FlagBadges({ overspend, duplicate }: { overspend: boolean; duplicate: boolean }) {
  const t = await getTranslations("expenses");
  if (!overspend && !duplicate) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {overspend && <Badge tone="FLAG">{t("flags.overspend")}</Badge>}
      {duplicate && <Badge tone="FLAG">{t("flags.duplicate")}</Badge>}
    </span>
  );
}
