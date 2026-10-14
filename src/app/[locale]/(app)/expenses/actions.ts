"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActionContext } from "@/lib/company";
import { audit } from "@/lib/audit";
import { redirect } from "@/i18n/navigation";
import { parseSarToHalalas } from "@/lib/ledger/money";
import { duplicateKey, isOverspend } from "@/lib/ledger/balances";
import { getAgentBalance } from "@/lib/ledger/db";
import { parseDateInput, toDateInput } from "@/lib/format";
import { readUploads, storeExpenseFiles, type StoredFile } from "@/lib/expense-files";
import { extractInvoice } from "@/lib/ocr";
import { parseZatcaQr, type ZatcaFields } from "@/lib/zatca";
import { deleteObject, storageConfigured } from "@/lib/storage";
import { notifySubmitted } from "@/lib/notify";
import type { FormState } from "@/components/action-form";

const TOLERANCE = 5; // halalas

async function checkCompanyProject(companyId: string, projectId: string | null) {
  const company = await prisma.company.findFirst({ where: { id: companyId, active: true } });
  if (!company) return "badCompany";
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId, active: true } });
    if (!project) return "badProject";
  }
  return null;
}

/**
 * The whole "new expense" form in one step: attachment plus fields. The agent may have used
 * "read automatically" first (readInvoiceAction) or typed everything; either way the values
 * that arrive here are what they confirmed.
 */
export async function createExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["AGENT"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;
  if (!(await storageConfigured())) return { ok: false, error: "storage" };

  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const read = await readUploads(formData.getAll("files"), { required: true });
  if ("error" in read) return { ok: false, error: read.error };

  // Every record is created under the company the agent is currently working in.
  const expense = await prisma.expense.create({ data: { agentId: me.id, companyId: ctx.company.id } });
  const qr = parseZatcaQr(String(formData.get("qr") ?? ""));
  const res = await persistExpense(expense, me, formData, read, qr);
  if (!res.ok) {
    // Nothing was stored yet (files are only saved after validation), so drop the empty shell.
    await prisma.expense.delete({ where: { id: expense.id } }).catch(() => null);
    return res;
  }
  await audit(me.id, "expense.create", "Expense", expense.id, { qr: !!qr, submitted: res.info === "submitted" });
  revalidatePath("/", "layout");
  if (res.info === "submitted") return redirect({ href: "/expenses?submitted=1", locale });
  return redirect({ href: `/expenses/${expense.id}`, locale });
}

export type ReadInvoiceResult =
  | {
      ok: true;
      zatca: boolean;
      fields: {
        vendorName: string;
        vendorVatNo: string;
        invoiceNumber: string;
        invoiceDate: string;
        subtotal: string;
        vatAmount: string;
        total: string;
      };
    }
  | { ok: false; error: "unauthorized" | "noFiles" | "fileType" | "fileTooLarge" | "tooManyFiles" | "storage" | "ocrOff" | "ocrFailed" | "nothing" };

const sar = (h: number | null | undefined) => (h === null || h === undefined ? "" : (h / 100).toFixed(2));

/** Reads one attached invoice (automatic reading) and returns the values for the form. Saves nothing. */
export async function readInvoiceAction(formData: FormData): Promise<ReadInvoiceResult> {
  const ctx = await getActionContext(["AGENT"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const read = await readUploads(formData.getAll("file").slice(0, 1), { required: true });
  if ("error" in read) return { ok: false, error: read.error === "storage" ? "storage" : read.error };

  const qr = parseZatcaQr(String(formData.get("qr") ?? ""));
  const ocr = await extractInvoice(read.files[0]);
  if (ocr.status === "skipped" && !qr) return { ok: false, error: "ocrOff" };
  if (ocr.status === "failed") console.error("OCR failed:", ocr.message);
  const o = ocr.status === "done" ? ocr.fields : null;
  if (!o && !qr) return { ok: false, error: ocr.status === "failed" ? "ocrFailed" : "nothing" };

  // The QR code is signed by the seller's system, so it wins over what the model read.
  return {
    ok: true,
    zatca: !!qr,
    fields: {
      vendorName: qr?.vendorName ?? o?.vendorName ?? "",
      vendorVatNo: qr?.vendorVatNo ?? o?.vendorVatNo ?? "",
      invoiceNumber: o?.invoiceNumber ?? "",
      invoiceDate: toDateInput(parseDateInput(qr?.invoiceDate ?? o?.invoiceDate ?? null)),
      subtotal: sar(qr?.subtotal ?? o?.subtotal),
      vatAmount: sar(qr?.vatAmount ?? o?.vatAmount),
      total: sar(qr?.total ?? o?.total),
    },
  };
}

const fieldsSchema = z.object({
  projectId: z.string().optional(),
  vendorName: z.string().trim().max(200).optional(),
  vendorVatNo: z.string().trim().max(30).optional(),
  invoiceNumber: z.string().trim().max(80).optional(),
  invoiceDate: z.string().optional(),
  subtotal: z.string().optional(),
  vatAmount: z.string().optional(),
  total: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

function opt(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : undefined;
}

type Draft = { id: string; status: "DRAFT" | "SUBMITTED" | "CONTROLLER_APPROVED" | "APPROVED" | "REJECTED"; companyId: string };

/** Validates the form, stores any new files and saves (or submits) the expense. Shared by create and edit. */
async function persistExpense(
  expense: Draft,
  me: { id: string },
  formData: FormData,
  read: { files: StoredFile[] },
  qr: ZatcaFields | null,
): Promise<FormState> {
  const submit = formData.get("intent") === "submit";
  const parsed = fieldsSchema.safeParse({
    projectId: opt(formData.get("projectId")),
    vendorName: opt(formData.get("vendorName")),
    vendorVatNo: opt(formData.get("vendorVatNo")),
    invoiceNumber: opt(formData.get("invoiceNumber")),
    invoiceDate: opt(formData.get("invoiceDate")),
    subtotal: opt(formData.get("subtotal")),
    vatAmount: opt(formData.get("vatAmount")),
    total: opt(formData.get("total")),
    notes: opt(formData.get("notes")),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;

  const cp = await checkCompanyProject(expense.companyId, d.projectId ?? null);
  if (cp) return { ok: false, error: cp };

  let subtotal: number | null = null;
  let vatAmount: number | null = null;
  let total: number | null = null;
  if (d.subtotal && (subtotal = parseSarToHalalas(d.subtotal)) === null) return { ok: false, error: "badAmount" };
  if (d.vatAmount && (vatAmount = parseSarToHalalas(d.vatAmount)) === null) return { ok: false, error: "badAmount" };
  if (d.total && (total = parseSarToHalalas(d.total)) === null) return { ok: false, error: "badAmount" };

  let invoiceDate: Date | null = null;
  if (d.invoiceDate && (invoiceDate = parseDateInput(d.invoiceDate)) === null) return { ok: false, error: "badDate" };

  const vatNo = d.vendorVatNo ? d.vendorVatNo.replace(/\s/g, "") : null;
  if (vatNo && !/^\d{15}$/.test(vatNo)) return { ok: false, error: "badVat" };

  if (read.files.length > 0 && !(await storageConfigured())) return { ok: false, error: "storage" };

  if (submit) {
    if (!d.vendorName || !invoiceDate || total === null || total <= 0) return { ok: false, error: "requiredFields" };
    if (subtotal !== null && vatAmount !== null && Math.abs(subtotal + vatAmount - total) > TOLERANCE) {
      return { ok: false, error: "inconsistent" };
    }
  }

  const stored = await storeExpenseFiles(expense.id, read.files);
  if ("error" in stored) return { ok: false, error: stored.error };

  const base = {
    projectId: d.projectId ?? null,
    vendorName: d.vendorName ?? null,
    vendorVatNo: vatNo,
    invoiceNumber: d.invoiceNumber ?? null,
    invoiceDate,
    subtotal,
    vatAmount,
    total,
    notes: d.notes ?? null,
    ...(qr && total !== null && qr.total === total ? { zatcaDecoded: true } : {}),
  };

  if (!submit) {
    await prisma.expense.update({ where: { id: expense.id }, data: base });
    revalidatePath("/", "layout");
    return { ok: true, error: null, info: "saved" };
  }

  // Flags are decided at the moment of submission.
  const bal = await getAgentBalance(expense.companyId, me.id);
  const overspendFlag = isOverspend(total as number, bal.available);

  const key = duplicateKey(vatNo, d.invoiceNumber, total);
  let duplicateFlag = false;
  if (key && vatNo && d.invoiceNumber) {
    const dup = await prisma.expense.findFirst({
      where: {
        id: { not: expense.id },
        vendorVatNo: vatNo,
        total,
        invoiceNumber: { equals: d.invoiceNumber, mode: "insensitive" },
        status: { in: ["SUBMITTED", "CONTROLLER_APPROVED", "APPROVED"] },
      },
      select: { id: true },
    });
    duplicateFlag = !!dup;
  }
  if (!duplicateFlag) {
    const mine = await prisma.expenseFile.findMany({ where: { expenseId: expense.id }, select: { sha256: true } });
    if (mine.length > 0) {
      const same = await prisma.expenseFile.findFirst({
        where: {
          sha256: { in: mine.map((m) => m.sha256) },
          expenseId: { not: expense.id },
          expense: { status: { in: ["SUBMITTED", "CONTROLLER_APPROVED", "APPROVED"] } },
        },
        select: { id: true },
      });
      duplicateFlag = !!same;
    }
  }

  await prisma.expense.update({
    where: { id: expense.id },
    data: { ...base, status: "SUBMITTED", submittedAt: new Date(), overspendFlag, duplicateFlag },
  });
  await audit(me.id, expense.status === "REJECTED" ? "expense.resubmit" : "expense.submit", "Expense", expense.id, {
    total,
    overspendFlag,
    duplicateFlag,
  });
  revalidatePath("/", "layout");
  await notifySubmitted(expense.id).catch((e) => console.error("notify failed", e));
  return { ok: true, error: null, info: "submitted" };
}

export async function saveExpenseAction(expenseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["AGENT"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;

  const expense = await prisma.expense.findFirst({ where: { id: expenseId, agentId: me.id, companyId: ctx.company.id } });
  if (!expense) return { ok: false, error: "notFound" };
  if (expense.status !== "DRAFT" && expense.status !== "REJECTED") return { ok: false, error: "notEditable" };

  const read = await readUploads(formData.getAll("files"), { required: false });
  if ("error" in read) return { ok: false, error: read.error };

  const res = await persistExpense(expense, me, formData, read, null);
  if (res.ok && res.info === "submitted") {
    const locale = formData.get("locale") === "ar" ? "ar" : "en";
    return redirect({ href: "/expenses?submitted=1", locale });
  }
  return res;
}

/** Agents may delete their own drafts that were never submitted. */
export async function deleteDraftAction(expenseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["AGENT"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, agentId: me.id, companyId: ctx.company.id },
    include: { files: true, _count: { select: { reviews: true } } },
  });
  if (!expense) return { ok: false, error: "notFound" };
  if (expense.status !== "DRAFT" || expense.submittedAt || expense._count.reviews > 0) return { ok: false, error: "notDeletable" };

  await prisma.$transaction(async (tx) => {
    await tx.expenseFile.deleteMany({ where: { expenseId } });
    await tx.expense.delete({ where: { id: expenseId } });
    await audit(me.id, "expense.deleteDraft", "Expense", expenseId, { files: expense.files.length }, tx);
  });
  if (await storageConfigured()) {
    await Promise.all(expense.files.map((f) => deleteObject(f.storageKey).catch((e) => console.error("delete object failed", e))));
  }
  revalidatePath("/", "layout");
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  return redirect({ href: "/expenses", locale });
}
