"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { btnPrimary, inputCls, labelCls, hintCls, Notice } from "@/components/ui";
import { changePasswordAction, type PasswordState } from "./actions";

export function PasswordForm({ forced }: { forced: boolean }) {
  const t = useTranslations("account");
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {
    ok: false,
    error: null,
  });

  if (state.ok) {
    return (
      <div className="mt-6 space-y-4">
        <Notice tone="good">{t("done")}</Notice>
        <Link href="/dashboard" className={btnPrimary}>
          {t("continue")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {forced && <Notice tone="warn">{t("forced")}</Notice>}
      <div>
        <label htmlFor="current" className={labelCls}>{t("current")}</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required dir="ltr" className={`${inputCls} text-start`} />
      </div>
      <div>
        <label htmlFor="next" className={labelCls}>{t("next")}</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={10} dir="ltr" className={`${inputCls} text-start`} />
        <p className={hintCls}>{t("rules")}</p>
      </div>
      <div>
        <label htmlFor="confirm" className={labelCls}>{t("confirm")}</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required dir="ltr" className={`${inputCls} text-start`} />
      </div>
      {state.error && <Notice tone="bad">{t(`errors.${state.error}`)}</Notice>}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
