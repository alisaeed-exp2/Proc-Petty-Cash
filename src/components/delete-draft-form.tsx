"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { btnDanger, Notice } from "@/components/ui";
import { emptyState, type FormState } from "@/components/action-form";

export function DeleteDraftForm({ action, locale }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; locale: string }) {
  const t = useTranslations("expenses");
  const [state, formAction, pending] = useActionState(action, emptyState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("deleteConfirm"))) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="locale" value={locale} />
      {state.error && <Notice tone="bad">{t(`errors.${state.error}`)}</Notice>}
      <button type="submit" disabled={pending} className={btnDanger}>{t("deleteDraft")}</button>
    </form>
  );
}
