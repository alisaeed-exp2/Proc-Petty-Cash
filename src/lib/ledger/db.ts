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

/** Reads ledger rows and open expenses from the database. Pass agentId to scope to one agent. */
export async function loadLedger(agentId?: string): Promise<{ ledger: LedgerRow[]; expenses: ExpenseRow[] }> {
  const [entries, expenses] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: agentId ? { agentId } : undefined,
      select: { type: true, agentId: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { ...(agentId ? { agentId } : {}), status: { in: ["SUBMITTED", "CONTROLLER_APPROVED", "REJECTED", "APPROVED"] } },
      select: { agentId: true, status: true, total: true },
    }),
  ]);
  return { ledger: entries, expenses };
}

export async function getAgentBalance(agentId: string): Promise<AgentBalance> {
  const { ledger, expenses } = await loadLedger(agentId);
  return agentBalance(agentId, ledger, expenses);
}

export async function getManagerSummary(): Promise<ManagerSummary> {
  const { ledger, expenses } = await loadLedger();
  return managerSummary(ledger, expenses);
}

/** Balances for every active agent plus any inactive agent with ledger activity. */
export async function getAllAgentBalances() {
  const [{ ledger, expenses }, agents] = await Promise.all([
    loadLedger(),
    prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
  ]);
  const balances = allAgentBalances(ledger, expenses, agents.filter((a) => a.active).map((a) => a.id));
  const byId = new Map(agents.map((a) => [a.id, a]));
  return balances
    .filter((b) => byId.has(b.agentId))
    .map((b) => ({ ...b, name: byId.get(b.agentId)!.name, active: byId.get(b.agentId)!.active }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
