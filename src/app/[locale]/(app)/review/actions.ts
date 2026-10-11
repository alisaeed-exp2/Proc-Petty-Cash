"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActionUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { redirect } from "@/i18n/navigation";
import { canReview } from "@/lib/ledger/balances";
import { notifyReviewed } from "@/lib/notify";
import type { FormState } from "@/components/action-form";

export async function reviewAction(expenseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["CONTROLLER"]);
  if (!me) return { ok: false, error: "unauthorized" };

  const intent = formData.get("intent");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  if (intent !== "approve" && intent !== "reject") return { ok: false, error: "invalid" };
  if (intent === "reject" && reason.length < 3) return { ok: false, error: "reasonRequired" };

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { ok: false, error: "notFound" };
  if (expense.status !== "SUBMITTED") return { ok: false, error: "alreadyReviewed" };
  if (!canReview(me.id, expense.agentId)) return { ok: false, error: "ownExpense" };
  if (intent === "approve" && (expense.total === null || expense.total <= 0)) return { ok: false, error: "invalid" };

  const approve = intent === "approve";
  const done = await prisma.$transaction(async (tx) => {
    // Only one reviewer can move it out of SUBMITTED.
    const moved = await tx.expense.updateMany({
      where: { id: expenseId, status: "SUBMITTED" },
      data: { status: approve ? "APPROVED" : "REJECTED" },
    });
    if (moved.count !== 1) return false;
    await tx.expenseReview.create({
      data: { expenseId, reviewerId: me.id, decision: approve ? "APPROVED" : "REJECTED", reason: reason || null },
    });
    if (approve) {
      await tx.ledgerEntry.create({
        data: {
          type: "EXPENSE",
          agentId: expense.agentId,
          amount: expense.total as number,
          occurredAt: expense.invoiceDate ?? new Date(),
          expenseId,
          note: expense.vendorName ?? null,
        },
      });
    }
    await audit(me.id, approve ? "expense.approve" : "expense.reject", "Expense", expenseId, { total: expense.total, reason: reason || null }, tx);
    return true;
  });
  if (!done) return { ok: false, error: "alreadyReviewed" };

  revalidatePath("/", "layout");
  await notifyReviewed(expenseId).catch((e) => console.error("notify failed", e));
  return redirect({ href: `/review?done=${approve ? "approved" : "rejected"}`, locale });
}
