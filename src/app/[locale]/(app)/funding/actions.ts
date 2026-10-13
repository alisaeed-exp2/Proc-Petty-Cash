"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActionContext } from "@/lib/company";
import { audit } from "@/lib/audit";
import { parseSarToHalalas } from "@/lib/ledger/money";
import { parseDateInput } from "@/lib/format";
import type { FormState } from "@/components/action-form";

const schema = z.object({
  amount: z.string().min(1),
  receivedAt: z.string().min(1),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function recordFundingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["MANAGER"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;
  const companyId = ctx.company.id;

  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    receivedAt: formData.get("receivedAt"),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const amount = parseSarToHalalas(parsed.data.amount);
  if (amount === null || amount <= 0) return { ok: false, error: "badAmount" };
  const receivedAt = parseDateInput(parsed.data.receivedAt);
  if (!receivedAt) return { ok: false, error: "badDate" };

  await prisma.$transaction(async (tx) => {
    const f = await tx.funding.create({
      data: {
        companyId,
        amount,
        receivedAt,
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
        recordedById: me.id,
      },
    });
    await tx.ledgerEntry.create({
      data: { type: "FUNDING", companyId, amount, occurredAt: receivedAt, sourceId: f.id, note: parsed.data.reference ?? null },
    });
    await audit(me.id, "funding.record", "Funding", f.id, { amount }, tx);
  });

  revalidatePath("/", "layout");
  return { ok: true, error: null, info: "recorded" };
}
