import ExcelJS from "exceljs";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/session";
import { companyName, getActiveCompany } from "@/lib/company";
import { REPORTS, buildReport, type Cell, type ReportKey } from "@/lib/reports";
import { formatDate } from "@/lib/format";
import { canSeeRecords } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { localName } from "@/lib/names";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OCEAN = "FF043E50";
const OFFWHITE = "FFE9E3DB";

export async function GET(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Unauthorized", { status: 401 });

  if (!canSeeRecords(user.role)) return new Response("Forbidden", { status: 403 });

  const company = await getActiveCompany(user.id, user.role);
  if (!company) return new Response("No company selected", { status: 400 });

  const { report } = await params;
  if (!(REPORTS as readonly string[]).includes(report)) return new Response("Not found", { status: 404 });
  const key = report as ReportKey;

  const url = new URL(req.url);
  const locale = url.searchParams.get("lang") === "ar" ? "ar" : "en";
  const filters = {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    agentId: url.searchParams.get("agentId") || undefined,
    invoiceTypeId: url.searchParams.get("invoiceTypeId") || undefined,
  };

  const r = await getTranslations({ locale, namespace: "reports" });
  const x = await getTranslations({ locale, namespace: "expenses" });
  const data = await buildReport(key, { role: user.role, userId: user.id, companyId: company.id }, filters, locale, {
    yes: r("yes"),
    type: (k) => r(`types.${k}`),
    status: (k) => x(`status.${k}`),
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "AKCC Petty Cash";
  wb.created = new Date();
  const ws = wb.addWorksheet(r(`names.${key}`).slice(0, 31), {
    views: [{ rightToLeft: locale === "ar", state: "frozen", ySplit: 4 }],
  });

  const ncols = data.cols.length;
  ws.mergeCells(1, 1, 1, Math.max(ncols, 2));
  ws.getCell(1, 1).value = `${companyName(company, locale)} - ${r(`names.${key}`)}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: OCEAN } };
  ws.mergeCells(2, 1, 2, Math.max(ncols, 2));
  const period = filters.from || filters.to ? `${filters.from ?? "…"} → ${filters.to ?? "…"}` : r("allDates");
  const typeRow = filters.invoiceTypeId ? await prisma.invoiceType.findUnique({ where: { id: filters.invoiceTypeId } }) : null;
  const typeNote = typeRow ? ` · ${r("invoiceType")}: ${localName(typeRow, locale)}` : "";
  ws.getCell(2, 1).value = `${r("generated")}: ${formatDate(new Date(), locale)} · ${r("period")}: ${period}${typeNote} · ${r("currencyNote")}`;
  ws.getCell(2, 1).font = { size: 10, color: { argb: "FF6B6B6B" } };

  const header = ws.getRow(4);
  data.cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = r(`cols.${c.key}`);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: OCEAN } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ws.getColumn(i + 1).width = c.width;
  });
  header.height = 24;

  const put = (rowNo: number) => {
    const row = ws.getRow(rowNo);
    return (i: number, v: Cell, kind: string) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      if (kind === "money") cell.numFmt = "#,##0.00";
      else if (kind === "date") cell.numFmt = "yyyy-mm-dd";
      else if (kind === "percent") cell.numFmt = "0.0%";
      else if (kind === "int") cell.numFmt = "0";
      cell.alignment = { vertical: "middle", horizontal: kind === "text" ? undefined : "center" };
    };
  };

  data.rows.forEach((row, ri) => {
    const set = put(5 + ri);
    data.cols.forEach((c, i) => set(i, row[c.key] ?? null, c.kind));
  });

  if (data.sumKeys.length > 0 && data.rows.length > 0) {
    const totalRowNo = 5 + data.rows.length;
    const set = put(totalRowNo);
    data.cols.forEach((c, i) => {
      if (i === 0) {
        set(i, r("totals"), "text");
      } else if (data.sumKeys.includes(c.key)) {
        const sum = data.rows.reduce((n, row) => n + (typeof row[c.key] === "number" ? (row[c.key] as number) : 0), 0);
        set(i, Math.round(sum * 100) / 100, c.kind);
      }
    });
    const tr = ws.getRow(totalRowNo);
    tr.font = { bold: true, color: { argb: OCEAN } };
    tr.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: OFFWHITE } };
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="akcc-${key}-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
