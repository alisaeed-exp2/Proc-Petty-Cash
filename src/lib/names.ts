/** Picks the Arabic or English name of a company / project for the current language. */
export function localName(o: { nameEn: string; nameAr: string }, locale: string): string {
  const primary = locale === "ar" ? o.nameAr : o.nameEn;
  return primary?.trim() ? primary : locale === "ar" ? o.nameEn : o.nameAr;
}
