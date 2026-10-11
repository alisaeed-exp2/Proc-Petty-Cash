"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Notice, Table, btnPrimary, td, tdNum, th, thNum } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { emptyState, type FormState } from "@/components/action-form";

export type QueueRow = {
  id: string;
  submitted: string;
  agent: string;
  vendor: string;
  company: string;
  project: string | null;
  total: string;
  overspend: boolean;
  duplicate: boolean;
  selectable: boolean;
  controllerApprover: string | null;
};

export function BulkQueue({
  rows,
  action,
  locale,
  showApprover,
}: {
  rows: QueueRow[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  locale: string;
  showApprover: boolean;
}) {
  const t = useTranslations("review");
  const x = useTranslations("expenses");
  const [state, formAction, pending] = useActionState(action, emptyState);
  const selectable = rows.filter((r) => r.selectable);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allOn = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const flaggedSelected = rows.filter((r) => selected.has(r.id) && (r.overspend || r.duplicate)).length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const msg = flaggedSelected > 0 ? t("bulkConfirmFlagged", { count: selected.size, flagged: flaggedSelected }) : t("bulkConfirm", { count: selected.size });
        if (!window.confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || selected.size === 0} className={`${btnPrimary} disabled:opacity-50`}>
          {t("approveSelected", { count: selected.size })}
        </button>
        {flaggedSelected > 0 && <Badge tone="FLAG">{t("flaggedSelected", { count: flaggedSelected })}</Badge>}
      </div>
      {state.error && <div className="mb-3"><Notice tone="bad">{t(`errors.${state.error}`)}</Notice></div>}
      <Table>
        <thead>
          <tr>
            <th className={th}>
              <input
                type="checkbox"
                aria-label={t("selectAll")}
                checked={allOn}
                onChange={() => setSelected(allOn ? new Set() : new Set(selectable.map((r) => r.id)))}
              />
            </th>
            <th className={th}>{t("submitted")}</th>
            <th className={th}>{t("agent")}</th>
            <th className={th}>{t("vendor")}</th>
            <th className={th}>{t("company")}</th>
            <th className={thNum}>{t("total")}</th>
            <th className={th}>{t("flags")}</th>
            {showApprover && <th className={th}>{t("controllerApproval")}</th>}
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                <input
                  type="checkbox"
                  aria-label={r.vendor}
                  disabled={!r.selectable}
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                />
              </td>
              <td className={td}>{r.submitted}</td>
              <td className={td}>{r.agent}</td>
              <td className={td}>{r.vendor}</td>
              <td className={td}>
                {r.company}
                {r.project && <div className="text-xs text-muted">{r.project}</div>}
              </td>
              <td className={tdNum}>{r.total}</td>
              <td className={td}>
                <span className="inline-flex flex-wrap gap-1.5">
                  {r.overspend && <Badge tone="FLAG">{x("flags.overspend")}</Badge>}
                  {r.duplicate && <Badge tone="FLAG">{x("flags.duplicate")}</Badge>}
                </span>
              </td>
              {showApprover && <td className={td}>{r.controllerApprover ?? "-"}</td>}
              <td className={td}>
                <Link href={`/review/${r.id}`} className="text-sm font-medium text-ocean underline underline-offset-4">
                  {t("open")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </form>
  );
}
