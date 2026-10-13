"use server";

import { revalidatePath } from "next/cache";
import type { ExpenseStatus, ReviewStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type AppUser } from "@/lib/session";
import { getActionContext } from "@/lib/company";
import { audit } from "@/lib/audit";
import { redirect } from "@/i18n/navigation";
import { canReview } from "@/lib/ledger/balances";
import { notifyReviewed } from "@/lib/notify";
import type { FormState } from "@/components/action-form";

/**
 * Two-step approval:
 *   SUBMITTED -> (controller approves) -> CONTROLLER_APPROVED -> (manager approves) -> APPROVED
 * Either reviewer can reject at their own step, which sends it back to the agent as REJECTED.
 * Only the final approval writes the EXPENSE ledger entry.
 */
function stepFor(me: AppUser, status: ExpenseStatus): { stage: ReviewStage; from: ExpenseStatus; approvedTo: ExpenseStatus } | null {
  const asManager = { stage: "MANAGER", from: "CONTROLLER_APPROVED", approvedTo: "APPROVED" } as const;
  const asController = { stage: "CONTROLLER", from: "SUBMITTED", approvedTo: "CONTROLLER_APPROVED" } as const;
  if (me.role === "MANAGER") return asManager;
  if (me.role === "CONTROLLER") return asController;
  // A system administrator may act at whichever step the expense is waiting at.
  if (me.role === "SYSTEM_ADMIN") return status === "CONTROLLER_APPROVED" ? asManager : status === "SUBMITTED" ? asController : null;
  return null;
}

/** Returns an error key, or null on success. */
async function decideOne(me: AppUser, companyId: string, expenseId: string, approve: boolean, reason: string): Promise<string | null> {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.companyId !== companyId) return "notFound";
  const step = stepFor(me, expense.status);
  if (!step || expense.status !== step.from) return "alreadyReviewed";
  if (!canReview(me.id, expense.agentId)) return "ownExpense";
  if (approve && (expense.total === null || expense.total <= 0)) return "invalid";

  const done = await prisma.$transaction(async (tx) => {
    // Only one reviewer can move it out of this step.
    const moved = await tx.expense.updateMany({
      where: { id: expenseId, status: step.from },
      data: { status: approve ? step.approvedTo : "REJECTED" },
    });
    if (moved.count !== 1) return false;
    await tx.expenseReview.create({
      data: { expenseId, reviewerId: me.id, stage: step.stage, decision: approve ? "APPROVED" : "REJECTED", reason: reason || null },
    });
    if (approve && step.approvedTo === "APPROVED") {
      await tx.ledgerEntry.create({
        data: {
          type: "EXPENSE",
          companyId: expense.companyId,
          agentId: expense.agentId,
          amount: expense.total as number,
          occurredAt: expense.invoiceDate ?? new Date(),
          expenseId,
          note: expense.vendorName ?? null,
        },
      });
    }
    await audit(
      me.id,
      `expense.${step.stage.toLowerCase()}.${approve ? "approve" : "reject"}`,
      "Expense",
      expenseId,
      { total: expense.total, reason: reason || null },
      tx,
    );
    return true;
  });
  if (!done) return "alreadyReviewed";
  await notifyReviewed(expenseId).catch((e) => console.error("notify failed", e));
  return null;
}

export async function reviewAction(expenseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["CONTROLLER", "MANAGER"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;

  const intent = formData.get("intent");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  if (intent !== "approve" && intent !== "reject") return { ok: false, error: "invalid" };
  if (intent === "reject" && reason.length < 3) return { ok: false, error: "reasonRequired" };

  const approve = intent === "approve";
  const err = await decideOne(me, ctx.company.id, expenseId, approve, reason);
  if (err) return { ok: false, error: err };

  revalidatePath("/", "layout");
  const outcome = !approve ? "rejected" : "approved";
  return redirect({ href: `/review?done=${outcome}`, locale });
}

/** Approves several expenses at once. Anything not eligible is skipped and counted. */
export async function bulkApproveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["CONTROLLER", "MANAGER"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const ids = [...new Set(formData.getAll("ids").map(String).filter(Boolean))].slice(0, 100);
  if (ids.length === 0) return { ok: false, error: "nothingSelected" };

  let approved = 0;
  for (const id of ids) {
    const err = await decideOne(me, ctx.company.id, id, true, "");
    if (!err) approved += 1;
  }
  revalidatePath("/", "layout");
  const outcome = "bulk";
  return redirect({ href: `/review?done=${outcome}&n=${approved}&skipped=${ids.length - approved}`, locale });
}
