"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { loginAction, type LoginState } from "./actions";

const fieldClass =
  "mt-1.5 block w-full rounded-control border border-line bg-white px-3.5 py-3 text-base text-ink shadow-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

export function LoginForm() {
  const t = useTranslations("login");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction.bind(null, locale),
    { error: null },
  );

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-ink">
          {t("email")}
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required dir="ltr" className={`${fieldClass} text-start`} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-ink">
          {t("password")}
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" className={`${fieldClass} text-start`} />
      </div>

      {state.error && (
        <p role="alert" className="rounded-control border border-status-rejected/30 bg-status-rejected/5 px-3.5 py-2.5 text-sm text-status-rejected">
          {state.error === "invalid" ? t("invalid") : t("required")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-control bg-brand-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>

      <div className="text-center">
        <Link href="/forgot-password" className="text-sm text-brand-700 underline underline-offset-4 hover:text-brand-900">
          {t("forgot")}
        </Link>
      </div>
    </form>
  );
}
