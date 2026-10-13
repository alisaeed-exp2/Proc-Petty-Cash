"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActionContext } from "@/lib/company";
import { audit } from "@/lib/audit";
import { parseSarToHalalas } from "@/lib/ledger/money";
import { parseDateInput } from "@/lib/format";
import { canAllocate, canReturn } from "@/lib/ledger/balances";
import { getAgentBalance, getManagerSummary } from "@/lib/ledger/db";
import type { FormState } from "@/components/action-form";

const schema = z.object({
  agentId: z.string().min(1),
  amount: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
});

function read(formData: FormData) {
  return schema.safeParse({
    agentId: formData.get("agentId"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    notes: formData.get("notes") || undefined,
  });
}

export async function allocateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["MANAGER"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;
  const companyId = ctx.company.id;
  const parsed = read(formData);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const amount = parseSarToHalalas(parsed.data.amount);
  if (amount === null || amount <= 0) return { ok: false, error: "badAmount" };
  const date = parseDateInput(parsed.data.date);
  if (!date) return { ok: false, error: "badDate" };

  const agent = await prisma.user.findFirst({ where: { id: parsed.data.agentId, role: "AGENT", active: true, companies: { some: { companyId } } } });
  if (!agent) return { ok: false, error: "badAgent" };

  const summary = await getManagerSummary(companyId);
  if (!canAllocate(amount, summary.unallocatedPool)) return { ok: false, error: "exceedsPool" };

  await prisma.$transaction(async (tx) => {
    const a = await tx.allocation.create({
      data: { companyId, agentId: agent.id, managerId: me.id, amount, allocatedAt: date, notes: parsed.data.notes ?? null },
    });
    await tx.ledgerEntry.create({
      data: { type: "ALLOCATION", companyId, agentId: agent.id, amount, occurredAt: date, sourceId: a.id, note: parsed.data.notes ?? null },
    });
    await audit(me.id, "allocation.create", "Allocation", a.id, { agentId: agent.id, amount }, tx);
  });

  revalidatePath("/", "layout");
  return { ok: true, error: null, info: "allocated" };
}

export async function returnCashAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["MANAGER"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;
  const companyId = ctx.company.id;
  const parsed = read(formData);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const amount = parseSarToHalalas(parsed.data.amount);
  if (amount === null || amount <= 0) return { ok: false, error: "badAmount" };
  const date = parseDateInput(parsed.data.date);
  if (!date) return { ok: false, error: "badDate" };

  const agent = await prisma.user.findFirst({ where: { id: parsed.data.agentId, role: "AGENT", companies: { some: { companyId } } } });
  if (!agent) return { ok: false, error: "badAgent" };

  const bal = await getAgentBalance(companyId, agent.id);
  if (!canReturn(amount, bal.cashOnHand)) return { ok: false, error: "exceedsCash" };

  await prisma.$transaction(async (tx) => {
    const r = await tx.cashReturn.create({
      data: { companyId, agentId: agent.id, managerId: me.id, amount, returnedAt: date, notes: parsed.data.notes ?? null },
    });
    await tx.ledgerEntry.create({
      data: { type: "RETURN", companyId, agentId: agent.id, amount, occurredAt: date, sourceId: r.id, note: parsed.data.notes ?? null },
    });
    await audit(me.id, "cashReturn.create", "CashReturn", r.id, { agentId: agent.id, amount }, tx);
  });

  revalidatePath("/", "layout");
  return { ok: true, error: null, info: "returned" };
}
