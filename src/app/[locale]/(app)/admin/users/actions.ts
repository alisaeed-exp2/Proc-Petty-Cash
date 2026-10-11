"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActionUser } from "@/lib/session";
import { generateTempPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/action-form";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["MANAGER", "CONTROLLER", "AGENT"]),
  locale: z.enum(["en", "ar"]),
});

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  if (await prisma.user.findUnique({ where: { email: data.email } })) return { ok: false, error: "emailTaken" };

  const temp = generateTempPassword();
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(temp, 12), mustChangePassword: true },
  });
  await audit(me.id, "user.create", "User", user.id, { email: user.email, role: user.role });
  revalidatePath("/", "layout");
  return { ok: true, error: null, info: "created", value: `${data.email}\n${temp}` };
}

export async function resetPasswordAction(userId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!target) return { ok: false, error: "notFound" };

  const temp = generateTempPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(temp, 12), mustChangePassword: true },
  });
  await audit(me.id, "user.resetPassword", "User", userId);
  return { ok: true, error: null, info: "reset", value: `${target.email}\n${temp}` };
}

export async function toggleUserActiveAction(userId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  if (me.id === userId) return { ok: false, error: "selfDeactivate" };
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  if (!target) return { ok: false, error: "notFound" };

  await prisma.user.update({ where: { id: userId }, data: { active: !target.active } });
  await audit(me.id, target.active ? "user.deactivate" : "user.activate", "User", userId);
  revalidatePath("/", "layout");
  return { ok: true, error: null };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["MANAGER", "CONTROLLER", "AGENT"]),
  locale: z.enum(["en", "ar"]),
});

export async function updateUserAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["MANAGER"]);
  if (!me) return { ok: false, error: "unauthorized" };
  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "notFound" };

  if (data.email !== target.email) {
    const other = await prisma.user.findUnique({ where: { email: data.email } });
    if (other) return { ok: false, error: "emailTaken" };
  }
  if (data.role !== target.role) {
    if (me.id === userId) return { ok: false, error: "selfRole" };
    // A role change would orphan cash and invoices tied to the old role.
    const [ledger, expenses, reviews] = await Promise.all([
      prisma.ledgerEntry.count({ where: { agentId: userId } }),
      prisma.expense.count({ where: { agentId: userId } }),
      prisma.expenseReview.count({ where: { reviewerId: userId } }),
    ]);
    if (ledger + expenses + reviews > 0) return { ok: false, error: "roleLocked" };
  }

  await prisma.user.update({ where: { id: userId }, data });
  await audit(me.id, "user.update", "User", userId, { from: { email: target.email, role: target.role }, to: { email: data.email, role: data.role } });
  revalidatePath("/", "layout");
  return { ok: true, error: null, info: "saved" };
}
