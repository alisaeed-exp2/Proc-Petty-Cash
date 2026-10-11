import test from "node:test";
import assert from "node:assert/strict";
import {
  agentBalance,
  managerSummary,
  allAgentBalances,
  isOverspend,
  canAllocate,
  canReturn,
  canReview,
  duplicateKey,
  percent,
  type LedgerRow,
  type ExpenseRow,
} from "./balances.ts";
import { parseSarToHalalas, formatHalalas, normalizeDigits } from "./money.ts";

// Amounts are halalas: 1,000 SAR = 100_000.
const ledger: LedgerRow[] = [
  { type: "FUNDING", amount: 1_000_000 }, // 10,000 SAR from finance
  { type: "ALLOCATION", agentId: "a1", amount: 300_000 }, // 3,000
  { type: "ALLOCATION", agentId: "a2", amount: 200_000 }, // 2,000
  { type: "RETURN", agentId: "a1", amount: 50_000 }, // a1 hands back 500
  { type: "EXPENSE", agentId: "a1", amount: 100_000 }, // 1,000 approved
  { type: "EXPENSE", agentId: "a2", amount: 25_050 }, // 250.50 approved
];

const expenses: ExpenseRow[] = [
  { agentId: "a1", status: "APPROVED", total: 100_000 },
  { agentId: "a2", status: "APPROVED", total: 25_050 },
  { agentId: "a1", status: "SUBMITTED", total: 40_000 }, // 400 pending
  { agentId: "a1", status: "REJECTED", total: 15_000 }, // 150 unresolved
  { agentId: "a2", status: "DRAFT", total: 99_999 }, // drafts never count
];

test("agent balance applies the documented formulas", () => {
  const b = agentBalance("a1", ledger, expenses);
  assert.equal(b.allocated, 300_000);
  assert.equal(b.returned, 50_000);
  assert.equal(b.netAllocated, 250_000);
  assert.equal(b.consumed, 100_000);
  assert.equal(b.pending, 40_000);
  assert.equal(b.unresolved, 15_000);
  assert.equal(b.cashOnHand, 150_000); // 2,500 - 1,000
  assert.equal(b.available, 110_000); // 1,500 - 400 pending
  assert.equal(b.percentConsumed, 40); // 1,000 / 2,500
});

test("drafts never count as pending or consumed", () => {
  const b = agentBalance("a2", ledger, expenses);
  assert.equal(b.pending, 0);
  assert.equal(b.consumed, 25_050);
  assert.equal(b.percentConsumed, 12.5); // 250.50 / 2,000 = 12.525 -> 12.5
});

test("agent with nothing allocated shows 0% not NaN", () => {
  const b = agentBalance("nobody", ledger, expenses);
  assert.equal(b.netAllocated, 0);
  assert.equal(b.percentConsumed, 0);
});

test("manager summary and unallocated pool", () => {
  const s = managerSummary(ledger, expenses);
  assert.equal(s.funded, 1_000_000);
  assert.equal(s.allocated, 500_000);
  assert.equal(s.returned, 50_000);
  assert.equal(s.unallocatedPool, 550_000); // 10,000 - 5,000 + 500
  assert.equal(s.consumed, 125_050);
  assert.equal(s.pending, 40_000);
  assert.equal(s.unresolved, 15_000);
  assert.equal(s.percentConsumed, 12.5);
  assert.equal(s.percentAllocated, 45); // (5,000 - 500) / 10,000
});

test("adjustments change consumed and can be negative", () => {
  const withAdj: LedgerRow[] = [...ledger, { type: "ADJUSTMENT", agentId: "a1", amount: -20_000 }];
  assert.equal(agentBalance("a1", withAdj, expenses).consumed, 80_000);
  assert.equal(managerSummary(withAdj, expenses).consumed, 105_050);
});

test("allAgentBalances covers agents from ledger, expenses and the explicit list", () => {
  const rows = allAgentBalances(ledger, expenses, ["a3"]);
  assert.deepEqual(rows.map((r) => r.agentId).sort(), ["a1", "a2", "a3"]);
});

test("non-integer money is rejected", () => {
  assert.throws(() => agentBalance("a1", [{ type: "ALLOCATION", agentId: "a1", amount: 10.5 }], []));
});

test("overspend flag compares against available balance", () => {
  assert.equal(isOverspend(110_000, 110_000), false);
  assert.equal(isOverspend(110_001, 110_000), true);
  assert.equal(isOverspend(1, -500), true);
});

test("allocation and return limits", () => {
  assert.equal(canAllocate(550_000, 550_000), true);
  assert.equal(canAllocate(550_001, 550_000), false);
  assert.equal(canAllocate(0, 550_000), false);
  assert.equal(canReturn(150_000, 150_000), true);
  assert.equal(canReturn(150_001, 150_000), false);
});

test("nobody reviews their own expense", () => {
  assert.equal(canReview("u1", "u1"), false);
  assert.equal(canReview("controller", "u1"), true);
});

test("duplicate key needs VAT no, invoice no and total", () => {
  assert.equal(duplicateKey("300012345600003", " INV-77 ", 11_500), "300012345600003|inv-77|11500");
  assert.equal(duplicateKey(null, "INV-77", 11_500), null);
  assert.equal(duplicateKey("300012345600003", "INV-77", null), null);
});

test("percent rounds to one decimal", () => {
  assert.equal(percent(1, 3), 33.3);
  assert.equal(percent(2, 3), 66.7);
  assert.equal(percent(5, 0), 0);
});

test("parseSarToHalalas handles English and Arabic input", () => {
  assert.equal(parseSarToHalalas("350.50"), 35_050);
  assert.equal(parseSarToHalalas("٣٥٠٫٥٠"), 35_050);
  assert.equal(parseSarToHalalas("1,234.5"), 123_450);
  assert.equal(parseSarToHalalas("SAR 12"), 1_200);
  assert.equal(parseSarToHalalas("١٢٣ ريال"), 12_300);
  assert.equal(parseSarToHalalas("12.345"), null);
  assert.equal(parseSarToHalalas("abc"), null);
  assert.equal(parseSarToHalalas(""), null);
});

test("formatHalalas uses grouped Western digits", () => {
  assert.equal(formatHalalas(35_050), "350.50");
  assert.equal(formatHalalas(123_456_789), "1,234,567.89");
  assert.equal(formatHalalas(5), "0.05");
  assert.equal(formatHalalas(-35_050), "-350.50");
  assert.equal(formatHalalas(0), "0.00");
});

test("normalizeDigits converts Arabic-Indic and Persian digits", () => {
  assert.equal(normalizeDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  assert.equal(normalizeDigits("۰۱۲۳۴۵۶۷۸۹"), "0123456789");
});

test("expenses awaiting manager approval still count as pending", () => {
  const b = agentBalance(
    "a1",
    [{ type: "ALLOCATION", agentId: "a1", amount: 100000 }],
    [
      { agentId: "a1", status: "SUBMITTED", total: 10000 },
      { agentId: "a1", status: "CONTROLLER_APPROVED", total: 5000 },
    ],
  );
  assert.equal(b.pending, 15000);
  assert.equal(b.available, 85000);
});
