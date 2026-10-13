"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActionContext } from "@/lib/company";
import { audit } from "@/lib/audit";
import { redirect } from "@/i18n/navigation";
import { parseSarToHalalas } from "@/lib/ledger/money";
import { duplicateKey, isOverspend } from "@/lib/ledger/balances";
import { getAgentBalance } from "@/lib/ledger/db";
import { parseDateInput } from "@/lib/format";
import { readUploads, storeExpenseFiles } from "@/lib/expense-files";
import { extractInvoice } from "@/lib/ocr";
import { parseZatcaQr } from "@/lib/zatca";
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

export async function createExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["AGENT"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;
  if (!(await storageConfigured())) return { ok: false, error: "storage" };

  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  // Every record is created under the company the agent is currently working in.
  const companyId = ctx.company.id;
  const projectId = String(formData.get("projectId") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  const cp = await checkCompanyProject(companyId, projectId);
  if (cp) return { ok: false, error: cp };

  const read = await readUploads(formData.getAll("files"), { required: true });
  if ("error" in read) return { ok: false, error: read.error };

  const expense = await prisma.expense.create({ data: { agentId: me.id, companyId, projectId, notes } });
  const stored = await storeExpenseFiles(expense.id, read.files);
  if ("error" in stored) {
    await prisma.expense.delete({ where: { id: expense.id } });
    return { ok: false, error: stored.error };
  }

  // Read the first file with OCR. A failure never blocks the agent: they can type the fields.
  const ocr = await extractInvoice(read.files[0]);
  const qr = parseZatcaQr(String(formData.get("qr") ?? ""));
  const o = ocr.status === "done" ? ocr.fields : null;
  if (o || qr) {
    // The QR code is signed by the seller's system, so it wins over what the model read.
    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        vendorName: qr?.vendorName ?? o?.vendorName ?? null,
        vendorVatNo: qr?.vendorVatNo ?? o?.vendorVatNo ?? null,
        invoiceNumber: o?.invoiceNumber ?? null,
        invoiceDate: parseDateInput(qr?.invoiceDate ?? o?.invoiceDate ?? null),
        subtotal: qr?.subtotal ?? o?.subtotal ?? null,
        vatAmount: qr?.vatAmount ?? o?.vatAmount ?? null,
        total: qr?.total ?? o?.total ?? null,
        zatcaDecoded: !!qr,
        ocrRaw: (ocr.status === "done" ? ocr.raw : { qr: true }) as Prisma.InputJsonObject,
      },
    });
  } else if (ocr.status === "failed") {
    console.error("OCR failed:", ocr.message);
  }
  await audit(me.id, "expense.create", "Expense", expense.id, { ocr: ocr.status, qr: !!qr });
  revalidatePath("/", "layout");
  return redirect({ href: `/expenses/${expense.id}?ocr=${o || qr ? "done" : ocr.status}`, locale });
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

export async function saveExpenseAction(expenseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getActionContext(["AGENT"]);
  if (!ctx) return { ok: false, error: "unauthorized" };
  const me = ctx.user;

  const expense = await prisma.expense.findFirst({ where: { id: expenseId, agentId: me.id, companyId: ctx.company.id } });
  if (!expense) return { ok: false, error: "notFound" };
  if (expense.status !== "DRAFT" && expense.status !== "REJECTED") return { ok: false, error: "notEditable" };

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

  const read = await readUploads(formData.getAll("files"), { required: false });
  if ("error" in read) return { ok: false, error: read.error };
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
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  return redirect({ href: "/expenses?submitted=1", locale });
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
