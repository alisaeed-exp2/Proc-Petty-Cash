"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { btnDanger, btnSecondary, inputCls, labelCls, Notice } from "@/components/ui";
import { emptyState, type FormState } from "@/components/action-form";

/** Manager-only: send an approved expense back to the agent as a draft, with a reason. */
export function ReturnForm({ action, locale }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; locale: string }) {
  const t = useTranslations("reports.return");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, emptyState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnSecondary}>
        {t("button")}
      </button>
    );
  }
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("confirm"))) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">{t("hint")}</p>
      <div>
        <label className={labelCls} htmlFor="return-reason">{t("reason")} *</label>
        <textarea id="return-reason" name="reason" rows={3} maxLength={500} required className={inputCls} placeholder={t("reasonHint")} />
      </div>
      {state.error && <Notice tone="bad">{t(`errors.${state.error}`)}</Notice>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={btnDanger}>{pending ? t("working") : t("submit")}</button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className={btnSecondary}>{t("cancel")}</button>
      </div>
    </form>
  );
}
