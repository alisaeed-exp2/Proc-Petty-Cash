import { parseSarToHalalas } from "@/lib/ledger/money";

export type OcrFields = {
  vendorName: string | null;
  vendorVatNo: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // yyyy-mm-dd, Gregorian
  subtotal: number | null; // halalas
  vatAmount: number | null;
  total: number | null;
};

export type OcrOutcome =
  | { status: "done"; fields: OcrFields; raw: unknown }
  | { status: "skipped" } // no API key
  | { status: "failed"; message: string };

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const PROMPT = `You read purchase invoices (Arabic, English or both; Saudi invoices often carry a ZATCA QR code and a 15-digit VAT number starting and ending with 3).
Extract the following from the invoice and answer with ONE JSON object only, no prose:
{
 "vendorName": string|null,        // seller name as printed (keep the original language)
 "vendorVatNo": string|null,       // seller VAT registration number, digits only
 "invoiceNumber": string|null,
 "invoiceDate": string|null,       // YYYY-MM-DD in the GREGORIAN calendar (convert Hijri dates if that is all that is printed)
 "subtotal": number|null,          // total before VAT, in SAR
 "vatAmount": number|null,         // VAT amount in SAR
 "total": number|null,             // grand total including VAT, in SAR
 "confidence": "high"|"medium"|"low"
}
Use plain numbers with a dot as decimal separator (convert Arabic-Indic digits). Use null for anything you cannot read; never guess.`;

function toHalalas(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  return parseSarToHalalas(String(v));
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

export async function extractInvoice(file: { data: Buffer; mimeType: string }): Promise<OcrOutcome> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { status: "skipped" };

  const base64 = file.data.toString("base64");
  const block =
    file.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: file.mimeType, data: base64 } };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { status: "failed", message: `API ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { status: "failed", message: "No JSON in model reply" };
    const raw = JSON.parse(match[0]) as Record<string, unknown>;

    const date = str(raw.invoiceDate);
    const vat = str(raw.vendorVatNo)?.replace(/\D/g, "") ?? null;
    return {
      status: "done",
      raw,
      fields: {
        vendorName: str(raw.vendorName),
        vendorVatNo: vat || null,
        invoiceNumber: str(raw.invoiceNumber),
        invoiceDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        subtotal: toHalalas(raw.subtotal),
        vatAmount: toHalalas(raw.vatAmount),
        total: toHalalas(raw.total),
      },
    };
  } catch (err) {
    return { status: "failed", message: err instanceof Error ? err.message : "OCR error" };
  }
}
