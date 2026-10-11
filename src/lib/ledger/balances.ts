// Pure balance calculations. No database access here, so the rules are easy to test.
//
// Definitions (all in integer halalas):
//   netAllocated  = allocations to the agent - cash returned by the agent
//   consumed      = approved expenses (ledger EXPENSE rows) + signed ADJUSTMENT rows
//   pending       = expenses SUBMITTED or CONTROLLER_APPROVED, awaiting final approval
//   unresolved    = expenses REJECTED and not yet corrected (cash still held by the agent)
//   cashOnHand    = netAllocated - consumed        (expected cash the agent should hold)
//   available     = cashOnHand - pending           (what the agent can still spend)
//   percentConsumed = consumed / netAllocated
// Manager pool:
//   unallocatedPool = funded - allocated + returned

export type LedgerType = "FUNDING" | "ALLOCATION" | "RETURN" | "EXPENSE" | "ADJUSTMENT";
export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "CONTROLLER_APPROVED" | "APPROVED" | "REJECTED";

/** Statuses where the money is committed but not yet approved. */
export const PENDING_STATUSES: ExpenseStatus[] = ["SUBMITTED", "CONTROLLER_APPROVED"];

export interface LedgerRow {
  type: LedgerType;
  agentId?: string | null;
  amount: number; // halalas; signed only for ADJUSTMENT
}

export interface ExpenseRow {
  agentId: string;
  status: ExpenseStatus;
  total: number | null; // halalas
}

export interface AgentBalance {
  agentId: string;
  allocated: number;
  returned: number;
  netAllocated: number;
  consumed: number;
  pending: number;
  unresolved: number;
  cashOnHand: number;
  available: number;
  /** Percentage with one decimal, e.g. 42.5. 0 when nothing is allocated. */
  percentConsumed: number;
}

export interface ManagerSummary {
  funded: number;
  allocated: number;
  returned: number;
  unallocatedPool: number;
  consumed: number;
  pending: number;
  unresolved: number;
  /** consumed / funded, one decimal. */
  percentConsumed: number;
  /** allocated (net of returns) / funded, one decimal. */
  percentAllocated: number;
}

function assertHalalas(n: number, label: string) {
  if (!Number.isInteger(n)) throw new Error(`${label} must be an integer number of halalas, got ${n}`);
}

function sum(rows: LedgerRow[], type: LedgerType, agentId?: string): number {
  let total = 0;
  for (const r of rows) {
    if (r.type !== type) continue;
    if (agentId !== undefined && r.agentId !== agentId) continue;
    assertHalalas(r.amount, `${type} amount`);
    total += r.amount;
  }
  return total;
}

function sumExpenses(expenses: ExpenseRow[], status: ExpenseStatus | ExpenseStatus[], agentId?: string): number {
  const wanted = Array.isArray(status) ? status : [status];
  let total = 0;
  for (const e of expenses) {
    if (!wanted.includes(e.status)) continue;
    if (agentId !== undefined && e.agentId !== agentId) continue;
    const t = e.total ?? 0;
    assertHalalas(t, "expense total");
    total += t;
  }
  return total;
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function agentBalance(
  agentId: string,
  ledger: LedgerRow[],
  expenses: ExpenseRow[],
): AgentBalance {
  const allocated = sum(ledger, "ALLOCATION", agentId);
  const returned = sum(ledger, "RETURN", agentId);
  const netAllocated = allocated - returned;
  const consumed = sum(ledger, "EXPENSE", agentId) + sum(ledger, "ADJUSTMENT", agentId);
  const pending = sumExpenses(expenses, PENDING_STATUSES, agentId);
  const unresolved = sumExpenses(expenses, "REJECTED", agentId);
  const cashOnHand = netAllocated - consumed;
  const available = cashOnHand - pending;

  return {
    agentId,
    allocated,
    returned,
    netAllocated,
    consumed,
    pending,
    unresolved,
    cashOnHand,
    available,
    percentConsumed: percent(consumed, netAllocated),
  };
}

export function managerSummary(ledger: LedgerRow[], expenses: ExpenseRow[]): ManagerSummary {
  const funded = sum(ledger, "FUNDING");
  const allocated = sum(ledger, "ALLOCATION");
  const returned = sum(ledger, "RETURN");
  const consumed = sum(ledger, "EXPENSE") + sum(ledger, "ADJUSTMENT");

  return {
    funded,
    allocated,
    returned,
    unallocatedPool: funded - allocated + returned,
    consumed,
    pending: sumExpenses(expenses, PENDING_STATUSES),
    unresolved: sumExpenses(expenses, "REJECTED"),
    percentConsumed: percent(consumed, funded),
    percentAllocated: percent(allocated - returned, funded),
  };
}

/** Balances for every agent that appears in the ledger or has expenses, plus the given ids. */
export function allAgentBalances(
  ledger: LedgerRow[],
  expenses: ExpenseRow[],
  agentIds: string[] = [],
): AgentBalance[] {
  const ids = new Set<string>(agentIds);
  for (const r of ledger) if (r.agentId) ids.add(r.agentId);
  for (const e of expenses) ids.add(e.agentId);
  return [...ids].map((id) => agentBalance(id, ledger, expenses));
}

/** An expense is flagged when it exceeds what the agent could still spend at submission time. */
export function isOverspend(expenseTotal: number, available: number): boolean {
  assertHalalas(expenseTotal, "expense total");
  return expenseTotal > available;
}

/** Can the manager allocate this much more from the unallocated pool? */
export function canAllocate(amount: number, unallocatedPool: number): boolean {
  assertHalalas(amount, "allocation");
  return amount > 0 && amount <= unallocatedPool;
}

/** Can the agent hand back this much? Cannot return more cash than they hold. */
export function canReturn(amount: number, cashOnHand: number): boolean {
  assertHalalas(amount, "return");
  return amount > 0 && amount <= cashOnHand;
}

/** Separation of duties: nobody approves or rejects their own expense. */
export function canReview(reviewerId: string, expenseAgentId: string): boolean {
  return reviewerId !== expenseAgentId;
}

/** Duplicate key: same seller VAT number + invoice number + total. */
export function duplicateKey(
  vendorVatNo: string | null | undefined,
  invoiceNumber: string | null | undefined,
  total: number | null | undefined,
): string | null {
  if (!vendorVatNo || !invoiceNumber || total == null) return null;
  return `${vendorVatNo.trim()}|${invoiceNumber.trim().toLowerCase()}|${total}`;
}
