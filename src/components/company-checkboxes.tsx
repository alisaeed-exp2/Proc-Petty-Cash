import { companyName } from "@/lib/company";

/** Checkbox list of companies, submitted as repeated "companyIds" fields. */
export function CompanyCheckboxes({
  companies,
  selected = [],
  locale,
}: {
  companies: { id: string; code: string; nameEn: string; nameAr: string }[];
  selected?: string[];
  locale: string;
}) {
  return (
    <div className="space-y-2">
      {companies.map((c) => (
        <label key={c.id} className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="companyIds" value={c.id} defaultChecked={selected.includes(c.id)} className="size-4 accent-[var(--color-ocean)]" />
          <span className="num text-xs text-muted">{c.code}</span>
          <span>{companyName(c, locale)}</span>
        </label>
      ))}
    </div>
  );
}
