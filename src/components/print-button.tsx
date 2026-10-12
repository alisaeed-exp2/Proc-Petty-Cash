"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { btnPrimary } from "@/components/ui";

/** Opens the print dialog once the report has rendered ("Save as PDF" is one of its destinations). */
export function PrintButton({ auto = true }: { auto?: boolean }) {
  const t = useTranslations("reports");
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(id);
  }, [auto]);
  return (
    <button type="button" onClick={() => window.print()} className={btnPrimary}>
      {t("print")}
    </button>
  );
}
