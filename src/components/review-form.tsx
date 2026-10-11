"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { btnDanger, btnPrimary, inputCls, labelCls, Notice } from "@/components/ui";
import { emptyState, type FormState } from "@/components/action-form";

export function ReviewForm({ action, locale }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; locale: string }) {
  const t = useTranslations("review");
  const [state, formAction, pending] = useActionState(action, emptyState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className={labelCls} htmlFor="reason">{t("reason")}</label>
        <textarea id="reason" name="reason" rows={3} maxLength={500} className={inputCls} placeholder={t("reasonHint")} />
      </div>
      {state.error && <Notice tone="bad">{t(`errors.${state.error}`)}</Notice>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="approve" disabled={pending} className={btnPrimary}>{t("approve")}</button>
        <button type="submit" name="intent" value="reject" disabled={pending} className={btnDanger}>{t("reject")}</button>
      </div>
    </form>
  );
}
