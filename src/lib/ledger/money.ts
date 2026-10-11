// Money helpers. All amounts are integer halalas (1 SAR = 100 halalas).

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXT_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic / Persian digits and Arabic separators to plain ASCII. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EXT_ARABIC_INDIC.indexOf(d)))
    .replace(/٫/g, ".") // Arabic decimal separator
    .replace(/[٬،]/g, ","); // Arabic thousands / comma
}

/**
 * Parses a SAR amount typed or OCR'd in either script ("350.50", "٣٥٠٫٥٠",
 * "1,234.5", "SAR 12") into integer halalas. Returns null if it is not a valid amount.
 */
export function parseSarToHalalas(input: string): number | null {
  const cleaned = normalizeDigits(input)
    .replace(/sar|sr|ر\.?\s?س|ريال/gi, "")
    .replace(/[\s ]/g, "")
    .replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const halalas = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(halalas) ? halalas : null;
}

/** Formats halalas as "1,234.50" (Western digits in both languages by design). */
export function formatHalalas(halalas: number): string {
  const sign = halalas < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(halalas));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}
