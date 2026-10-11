"use server";

import { signOut } from "@/auth";

export async function logoutAction(locale: string) {
  await signOut({ redirectTo: `/${locale}/login` });
}
