import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localName } from "@/lib/names";
import { getAllAgentBalances } from "@/lib/ledger/db";

export const REPORTS = ["consumption", "agents", "companies", "cash", "pending"] as const;
export type ReportKey = (typeof REPORTS)[number];

export type Scope = { role: Role; userId: string; companyId: string };
export type Filters = { from?: string; to?: string; agentId?: string };
export type Labels = {
  yes: string;
  type: (k: string) => string;
  status: (k: string) => string;
};

export type Kind = "text" | "money" | "date" | "int" | "percent";
export type Col = { key: string; width: number; kind: Kind };
export type Cell = string | number | Date | null;
export type ReportData = { cols: Col[]; rows: Record<string, Cell>[]; sumKeys: string[] };

const sar = (h: number | null) => (h === null ? null : h / 100);

function range(f: Filters): { gte?: Date; lte?: Date } | undefined {
  const gte = f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from) ? new Date(`${f.from}T00:00:00+03:00`) : undefined;
  const lte = f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to) ? new Date(`${f.to}T23:59:59.999+03:00`) : undefined;
  return gte || lte ? { gte, lte } : undefined;
}

/** Agents only ever see their own rows; managers and controllers may narrow by agent. */
function agentFilter(scope: Scope, f: Filters): string | undefined {
  return scope.role === "AGENT" ? scope.userId : f.agentId || undefined;
}

export async function buildReport(
  report: ReportKey,
  scope: Scope,
  f: Filters,
  locale: string,
  labels: Labels,
): Promise<ReportData> {
  const agentId = agentFilter(scope, f);
  const dates = range(f);

  if (report === "consumption") {
    const rows = await prisma.expense.findMany({
      where: {
        status: "APPROVED",
        ...(agentId ? { agentId } : {}),
        companyId: scope.companyId,
        ...(dates ? { invoiceDate: dates } : {}),
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      include: {
        agent: { select: { name: true } },
        company: true,
        project: true,
        reviews: { where: { decision: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 1, include: { reviewer: { select: { name: true } } } },
      },
    });
    return {
      cols: [
        { key: "invoiceDate", width: 13, kind: "date" },
        { key: "agent", width: 22, kind: "text" },
        { key: "company", width: 26, kind: "text" },
        { key: "project", width: 24, kind: "text" },
        { key: "vendor", width: 30, kind: "text" },
        { key: "vatNo", width: 18, kind: "text" },
        { key: "invoiceNo", width: 16, kind: "text" },
        { key: "subtotal", width: 14, kind: "money" },
        { key: "vat", width: 12, kind: "money" },
        { key: "total", width: 14, kind: "money" },
        { key: "overspend", width: 11, kind: "text" },
        { key: "duplicate", width: 11, kind: "text" },
        { key: "approvedAt", width: 13, kind: "date" },
        { key: "approver", width: 20, kind: "text" },
      ],
      sumKeys: ["subtotal", "vat", "total"],
      rows: rows.map((e) => ({
        invoiceDate: e.invoiceDate,
        agent: e.agent.name,
        company: localName(e.company, locale),
        project: e.project ? localName(e.project, locale) : null,
        vendor: e.vendorName,
        vatNo: e.vendorVatNo,
        invoiceNo: e.invoiceNumber,
        subtotal: sar(e.subtotal),
        vat: sar(e.vatAmount),
        total: sar(e.total),
        overspend: e.overspendFlag ? labels.yes : null,
        duplicate: e.duplicateFlag ? labels.yes : null,
        approvedAt: e.reviews[0]?.createdAt ?? null,
        approver: e.reviews[0]?.reviewer.name ?? null,
      })),
    };
  }

  if (report === "agents") {
    let balances = await getAllAgentBalances(scope.companyId);
    if (agentId) balances = balances.filter((b) => b.agentId === agentId);
    return {
      cols: [
        { key: "agent", width: 26, kind: "text" },
        { key: "allocated", width: 16, kind: "money" },
        { key: "returned", width: 16, kind: "money" },
        { key: "netAllocated", width: 16, kind: "money" },
        { key: "consumed", width: 16, kind: "money" },
        { key: "percent", width: 12, kind: "percent" },
        { key: "residual", width: 16, kind: "money" },
        { key: "pending", width: 16, kind: "money" },
        { key: "unresolved", width: 16, kind: "money" },
        { key: "available", width: 16, kind: "money" },
      ],
      sumKeys: ["allocated", "returned", "netAllocated", "consumed", "residual", "pending", "unresolved", "available"],
      rows: balances.map((b) => ({
        agent: b.name,
        allocated: sar(b.allocated),
        returned: sar(b.returned),
        netAllocated: sar(b.netAllocated),
        consumed: sar(b.consumed),
        percent: b.percentConsumed / 100,
        residual: sar(b.cashOnHand),
        pending: sar(b.pending),
        unresolved: sar(b.unresolved),
        available: sar(b.available),
      })),
    };
  }

  if (report === "companies") {
    const rows = await prisma.expense.findMany({
      where: {
        status: "APPROVED",
        ...(agentId ? { agentId } : {}),
        companyId: scope.companyId,
        ...(dates ? { invoiceDate: dates } : {}),
      },
      include: { company: true, project: true },
    });
    const groups = new Map<string, { company: string; project: string | null; count: number; subtotal: number; vat: number; total: number }>();
    for (const e of rows) {
      const key = `${e.companyId}|${e.projectId ?? ""}`;
      const g = groups.get(key) ?? {
        company: localName(e.company, locale),
        project: e.project ? localName(e.project, locale) : null,
        count: 0,
        subtotal: 0,
        vat: 0,
        total: 0,
      };
      g.count += 1;
      g.subtotal += e.subtotal ?? 0;
      g.vat += e.vatAmount ?? 0;
      g.total += e.total ?? 0;
      groups.set(key, g);
    }
    return {
      cols: [
        { key: "company", width: 30, kind: "text" },
        { key: "project", width: 28, kind: "text" },
        { key: "count", width: 12, kind: "int" },
        { key: "subtotal", width: 16, kind: "money" },
        { key: "vat", width: 14, kind: "money" },
        { key: "total", width: 16, kind: "money" },
      ],
      sumKeys: ["count", "subtotal", "vat", "total"],
      rows: [...groups.values()]
        .sort((a, b) => a.company.localeCompare(b.company) || (a.project ?? "").localeCompare(b.project ?? ""))
        .map((g) => ({ ...g, subtotal: g.subtotal / 100, vat: g.vat / 100, total: g.total / 100 })),
    };
  }

  if (report === "cash") {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        companyId: scope.companyId,
        type: { in: ["FUNDING", "ALLOCATION", "RETURN", "ADJUSTMENT"] },
        ...(scope.role === "AGENT" ? { agentId: scope.userId } : agentId ? { agentId } : {}),
        ...(dates ? { occurredAt: dates } : {}),
      },
      orderBy: { occurredAt: "desc" },
      include: { agent: { select: { name: true } } },
    });
    return {
      cols: [
        { key: "date", width: 13, kind: "date" },
        { key: "type", width: 18, kind: "text" },
        { key: "agent", width: 24, kind: "text" },
        { key: "amount", width: 16, kind: "money" },
        { key: "note", width: 40, kind: "text" },
      ],
      sumKeys: [],
      rows: entries.map((e) => ({
        date: e.occurredAt,
        type: labels.type(e.type),
        agent: e.agent?.name ?? null,
        amount: sar(e.amount),
        note: e.note,
      })),
    };
  }

  // pending: submitted (awaiting controller) and rejected (unresolved with the agent)
  const rows = await prisma.expense.findMany({
    where: {
      status: { in: ["SUBMITTED", "CONTROLLER_APPROVED", "REJECTED"] },
      ...(agentId ? { agentId } : {}),
      companyId: scope.companyId,
    },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
    include: {
      agent: { select: { name: true } },
      company: true,
      project: true,
      reviews: { where: { decision: "REJECTED" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return {
    cols: [
      { key: "status", width: 18, kind: "text" },
      { key: "submittedAt", width: 13, kind: "date" },
      { key: "agent", width: 22, kind: "text" },
      { key: "company", width: 26, kind: "text" },
      { key: "project", width: 24, kind: "text" },
      { key: "vendor", width: 30, kind: "text" },
      { key: "invoiceNo", width: 16, kind: "text" },
      { key: "total", width: 14, kind: "money" },
      { key: "overspend", width: 11, kind: "text" },
      { key: "duplicate", width: 11, kind: "text" },
      { key: "reason", width: 40, kind: "text" },
    ],
    sumKeys: ["total"],
    rows: rows.map((e) => ({
      status: labels.status(e.status),
      submittedAt: e.submittedAt,
      agent: e.agent.name,
      company: localName(e.company, locale),
      project: e.project ? localName(e.project, locale) : null,
      vendor: e.vendorName,
      invoiceNo: e.invoiceNumber,
      total: sar(e.total),
      overspend: e.overspendFlag ? labels.yes : null,
      duplicate: e.duplicateFlag ? labels.yes : null,
      reason: e.status === "REJECTED" ? (e.reviews[0]?.reason ?? null) : null,
    })),
  };
}
