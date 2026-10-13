import { prisma } from "@/lib/prisma";
import {
  agentBalance,
  allAgentBalances,
  managerSummary,
  type AgentBalance,
  type ExpenseRow,
  type LedgerRow,
  type ManagerSummary,
} from "./balances";

/** Ledger rows and open expenses of one company. Pass agentId to scope to one agent. */
export async function loadLedger(companyId: string, agentId?: string): Promise<{ ledger: LedgerRow[]; expenses: ExpenseRow[] }> {
  const [entries, expenses] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { companyId, ...(agentId ? { agentId } : {}) },
      select: { type: true, agentId: true, amount: true },
    }),
    prisma.expense.findMany({
      where: {
        companyId,
        ...(agentId ? { agentId } : {}),
        status: { in: ["SUBMITTED", "CONTROLLER_APPROVED", "REJECTED", "APPROVED"] },
      },
      select: { agentId: true, status: true, total: true },
    }),
  ]);
  return { ledger: entries, expenses };
}

export async function getAgentBalance(companyId: string, agentId: string): Promise<AgentBalance> {
  const { ledger, expenses } = await loadLedger(companyId, agentId);
  return agentBalance(agentId, ledger, expenses);
}

export async function getManagerSummary(companyId: string): Promise<ManagerSummary> {
  const { ledger, expenses } = await loadLedger(companyId);
  return managerSummary(ledger, expenses);
}

/** Balances in one company for every agent assigned to it or with activity in it. */
export async function getAllAgentBalances(companyId: string) {
  const [{ ledger, expenses }, agents] = await Promise.all([
    loadLedger(companyId),
    prisma.user.findMany({
      where: {
        role: "AGENT",
        OR: [{ companies: { some: { companyId } } }, { ledgerEntries: { some: { companyId } } }],
      },
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const balances = allAgentBalances(ledger, expenses, agents.filter((a) => a.active).map((a) => a.id));
  const byId = new Map(agents.map((a) => [a.id, a]));
  return balances
    .filter((b) => byId.has(b.agentId))
    .map((b) => ({ ...b, name: byId.get(b.agentId)!.name, active: byId.get(b.agentId)!.active }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
