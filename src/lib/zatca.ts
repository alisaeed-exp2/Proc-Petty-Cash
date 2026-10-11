import { parseSarToHalalas } from "./ledger/money.ts";

export type ZatcaFields = {
  vendorName: string | null;
  vendorVatNo: string | null;
  invoiceDate: string | null; // yyyy-mm-dd (Riyadh)
  total: number | null; // halalas
  vatAmount: number | null;
  subtotal: number | null;
};

/** Decodes the TLV payload of a Saudi e-invoice (ZATCA) QR code. Returns null if it is not one. */
export function parseZatcaQr(base64: string): ZatcaFields | null {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64.trim(), "base64");
  } catch {
    return null;
  }
  const tags = new Map<number, string>();
  let i = 0;
  while (i + 2 <= bytes.length) {
    const tag = bytes[i];
    const len = bytes[i + 1];
    if (i + 2 + len > bytes.length) return null;
    tags.set(tag, bytes.subarray(i + 2, i + 2 + len).toString("utf8"));
    i += 2 + len;
  }
  if (!tags.has(1) || !tags.has(2) || !tags.has(4)) return null;

  const vat = (tags.get(2) ?? "").replace(/\D/g, "");
  const total = parseSarToHalalas(tags.get(4) ?? "");
  const vatAmount = tags.has(5) ? parseSarToHalalas(tags.get(5) ?? "") : null;
  if (total === null) return null;

  let invoiceDate: string | null = null;
  const ts = tags.get(3);
  if (ts) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      // Timestamps without a zone are Riyadh local time; the date part is what we keep.
      invoiceDate = /^\d{4}-\d{2}-\d{2}/.test(ts) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(ts)
        ? ts.slice(0, 10)
        : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(d);
    }
  }
  return {
    vendorName: (tags.get(1) ?? "").trim() || null,
    vendorVatNo: vat || null,
    invoiceDate,
    total,
    vatAmount,
    subtotal: vatAmount !== null ? total - vatAmount : null,
  };
}
