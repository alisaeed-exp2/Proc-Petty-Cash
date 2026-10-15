"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActionUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/action-form";

const schema = z.object({
  code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().min(1).max(160),
});

function read(fd: FormData) {
  return schema.safeParse({ code: fd.get("code"), nameEn: fd.get("nameEn"), nameAr: fd.get("nameAr") });
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createInvoiceTypeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const parsed = read(formData);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (await prisma.invoiceType.findUnique({ where: { code: parsed.data.code } })) return { ok: false, error: "codeTaken" };
  const row = await prisma.invoiceType.create({ data: parsed.data });
  await audit(me.id, "invoiceType.create", "InvoiceType", row.id, parsed.data);
  refresh();
  return { ok: true, error: null, info: "created" };
}

export async function updateInvoiceTypeAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const parsed = read(formData);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await prisma.invoiceType.findUnique({ where: { id }, select: { id: true } }))) return { ok: false, error: "notFound" };
  const clash = await prisma.invoiceType.findFirst({ where: { code: parsed.data.code, id: { not: id } } });
  if (clash) return { ok: false, error: "codeTaken" };
  await prisma.invoiceType.update({ where: { id }, data: parsed.data });
  await audit(me.id, "invoiceType.update", "InvoiceType", id, parsed.data);
  refresh();
  return { ok: true, error: null, info: "saved" };
}

export async function toggleInvoiceTypeAction(id: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const row = await prisma.invoiceType.findUnique({ where: { id }, select: { active: true } });
  if (!row) return { ok: false, error: "notFound" };
  await prisma.invoiceType.update({ where: { id }, data: { active: !row.active } });
  await audit(me.id, row.active ? "invoiceType.deactivate" : "invoiceType.activate", "InvoiceType", id);
  refresh();
  return { ok: true, error: null };
}
