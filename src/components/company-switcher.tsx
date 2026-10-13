"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { selectCompanyAction } from "@/app/[locale]/(app)/select-company/actions";

export type SwitcherCompany = { id: string; name: string };

/** Top-bar company name. With more than one allowed company it becomes a switcher. */
export function CompanySwitcher({
  companies,
  currentId,
  currentName,
  locale,
}: {
  companies: SwitcherCompany[];
  currentId: string | null;
  currentName: string | null;
  locale: string;
}) {
  const t = useTranslations("ctx");
  const form = useRef<HTMLFormElement>(null);
  const canSwitch = companies.length > 1;

  return (
    <form ref={form} action={selectCompanyAction} className="flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{t("company")}</span>
      {canSwitch ? (
        <select
          name="companyId"
          aria-label={t("switch")}
          value={currentId ?? ""}
          onChange={() => form.current?.requestSubmit()}
          className="max-w-[16rem] rounded-control border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ocean"
        >
          {currentId === null && (
            <option value="" disabled>
              {t("choose")}
            </option>
          )}
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="font-display text-base font-semibold text-ocean">{currentName ?? t("noneSelected")}</span>
      )}
    </form>
  );
}
