"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { btnPrimary, Notice } from "@/components/ui";

export type FormState = {
  ok: boolean;
  error: string | null; // translation key under <namespace>.errors
  info?: string | null; // translation key under <namespace>.info
  value?: string | null; // extra payload shown in a copyable box (e.g. a temporary password)
};

export const emptyState: FormState = { ok: false, error: null };

/**
 * A form bound to a server action, with pending state, translated success / error
 * messages, and optional reset after success.
 */
export function ActionForm({
  action,
  namespace,
  submit,
  children,
  className = "space-y-4",
  buttonClassName = btnPrimary,
  resetOnSuccess = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  namespace: string;
  submit: string;
  children?: ReactNode;
  className?: string;
  buttonClassName?: string;
  resetOnSuccess?: boolean;
}) {
  const t = useTranslations(namespace);
  const common = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, emptyState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state.error && <Notice tone="bad">{t(`errors.${state.error}`)}</Notice>}
      {state.ok && state.info && <Notice tone="good">{t(`info.${state.info}`)}</Notice>}
      {state.ok && state.value && (
        <pre dir="ltr" className="select-all whitespace-pre-wrap rounded-control border border-gold bg-gold-25 px-3.5 py-2.5 text-start text-sm text-ink">
          {state.value}
        </pre>
      )}
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? common("saving") : submit}
      </button>
    </form>
  );
}
