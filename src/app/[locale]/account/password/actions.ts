"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { audit } from "@/lib/audit";

export type PasswordState = { ok: boolean; error: string | null };

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(10).max(128),
  confirm: z.string(),
});

export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = schema.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "tooShort" };
  const { current, next, confirm } = parsed.data;
  if (next !== confirm) return { ok: false, error: "mismatch" };
  if (next === current) return { ok: false, error: "same" };
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return { ok: false, error: "weak" };

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) return { ok: false, error: "wrongCurrent" };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false, passwordChangedAt: new Date() },
  });
  await audit(user.id, "password.change", "User", user.id);
  return { ok: true, error: null };
}
