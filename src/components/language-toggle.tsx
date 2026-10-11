"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  const other = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      className={`inline-flex items-center gap-2 text-sm text-ocean-75 hover:text-ocean ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M3 5h8M7 3v2m0 0c0 4-2 7-4 8m4-8c0 3 2 6 5 8M13 21l4.5-10L22 21m-7.5-3h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span lang={other}>{t("language")}</span>
    </Link>
  );
}
