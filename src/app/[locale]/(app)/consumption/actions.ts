"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActionContext } from "@/lib/company";
import { audit } from "@/lib/audit";
import { redirect } from "@/i18n/navigation";
import { notifyReturned } from "@/lib/notify";
import type { FormState } from "@/components/action-form";

/**
 * Sends an approved expense back to the agent as a draft.
 *
 * The ledger is append-only, so the consumption is not deleted: a negative ADJUSTMENT linked to the
 * expense cancels the original EXPENSE entry. Balances, the dashboard and the reports read the
 * ledger and the expense status, so they update on their own. Approving it again later writes a
 * new EXPENSE entry. The review history keeps every decision, including this return and its reason.
 */
export async function returnToDraftAction(expenseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["MANAGER"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (reason.length < 3) return { ok: false, error: "reasonRequired" };

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.companyId !== ctx.company.id) return { ok: false, error: "notFound" };
  if (expense.status !== "APPROVED") return { ok: false, error: "notApproved" };

  const done = await prisma.$transaction(async (tx) => {
    // Only one return can win, even if two people click at the same time.
    const moved = await tx.expense.updateMany({
      where: { id: expenseId, status: "APPROVED" },
      data: { status: "DRAFT", overspendFlag: false, duplicateFlag: false },
    });
    if (moved.count !== 1) return false;

    await tx.expenseReview.create({
      data: { expenseId, reviewerId: me.id, stage: "MANAGER", decision: "RETURNED", reason },
    });

    // Cancel whatever is still counted as consumed for this expense (normally one EXPENSE entry).
    const entries = await tx.ledgerEntry.findMany({
      where: { expenseId, type: { in: ["EXPENSE", "ADJUSTMENT"] } },
      orderBy: { createdAt: "asc" },
      select: { amount: true, type: true, occurredAt: true },
    });
    const net = entries.reduce((n, e) => n + e.amount, 0);
    if (net !== 0) {
      const original = entries.find((e) => e.type === "EXPENSE");
      await tx.ledgerEntry.create({
        data: {
          type: "ADJUSTMENT",
          companyId: expense.companyId,
          agentId: expense.agentId,
          amount: -net,
          // Same date as the original entry, so monthly figures net out in the right month.
          occurredAt: original?.occurredAt ?? expense.invoiceDate ?? new Date(),
          expenseId,
          note: `Returned to draft: ${expense.vendorName ?? "-"}`,
        },
      });
    }

    await audit(me.id, "expense.returnToDraft", "Expense", expenseId, { total: expense.total, reversed: net, reason }, tx);
    return true;
  });
  if (!done) return { ok: false, error: "notApproved" };

  await notifyReturned(expenseId).catch((e) => console.error("notify failed", e));
  revalidatePath("/", "layout");
  return redirect({ href: "/consumption?returned=1", locale });
}
