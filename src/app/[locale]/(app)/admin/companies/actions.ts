"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActionUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/action-form";

const nameFields = {
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().min(1).max(160),
};
const codeField = z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/);

const createSchema = z.object({ code: codeField, ...nameFields });
const updateSchema = z.object({ code: codeField, ...nameFields });

function refresh() {
  revalidatePath("/", "layout");
}

export async function createCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const parsed = createSchema.safeParse({
    code: formData.get("code"),
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (await prisma.company.findUnique({ where: { code: parsed.data.code } })) return { ok: false, error: "codeTaken" };

  const company = await prisma.company.create({ data: parsed.data });
  await audit(me.id, "company.create", "Company", company.id, parsed.data);
  refresh();
  return { ok: true, error: null, info: "created" };
}

export async function updateCompanyAction(companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const parsed = updateSchema.safeParse({ code: formData.get("code"), nameEn: formData.get("nameEn"), nameAr: formData.get("nameAr") });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const clash = await prisma.company.findFirst({ where: { code: parsed.data.code, id: { not: companyId } } });
  if (clash) return { ok: false, error: "codeTaken" };
  await prisma.company.update({ where: { id: companyId }, data: parsed.data });
  await audit(me.id, "company.update", "Company", companyId, parsed.data);
  refresh();
  return { ok: true, error: null, info: "saved" };
}

export async function toggleCompanyActiveAction(companyId: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { active: true } });
  if (!c) return { ok: false, error: "notFound" };
  await prisma.company.update({ where: { id: companyId }, data: { active: !c.active } });
  await audit(me.id, c.active ? "company.deactivate" : "company.activate", "Company", companyId);
  refresh();
  return { ok: true, error: null };
}

export async function createProjectAction(companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const parsed = createSchema.safeParse({
    code: formData.get("code"),
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const exists = await prisma.project.findUnique({
    where: { companyId_code: { companyId, code: parsed.data.code } },
  });
  if (exists) return { ok: false, error: "codeTaken" };

  const project = await prisma.project.create({ data: { companyId, ...parsed.data } });
  await audit(me.id, "project.create", "Project", project.id, parsed.data);
  refresh();
  return { ok: true, error: null, info: "created" };
}

export async function updateProjectAction(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const parsed = updateSchema.safeParse({ code: formData.get("code"), nameEn: formData.get("nameEn"), nameAr: formData.get("nameAr") });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const current = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
  if (!current) return { ok: false, error: "notFound" };
  const clash = await prisma.project.findFirst({ where: { companyId: current.companyId, code: parsed.data.code, id: { not: projectId } } });
  if (clash) return { ok: false, error: "codeTaken" };
  await prisma.project.update({ where: { id: projectId }, data: parsed.data });
  await audit(me.id, "project.update", "Project", projectId, parsed.data);
  refresh();
  return { ok: true, error: null, info: "saved" };
}

export async function toggleProjectActiveAction(projectId: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { active: true } });
  if (!p) return { ok: false, error: "notFound" };
  await prisma.project.update({ where: { id: projectId }, data: { active: !p.active } });
  await audit(me.id, p.active ? "project.deactivate" : "project.activate", "Project", projectId);
  refresh();
  return { ok: true, error: null };
}
