"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error: "invalid" | "required" | null };

export async function loginAction(
  locale: string,
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "required" };

  try {
    await signIn("credentials", { email, password, redirectTo: `/${locale}/dashboard` });
  } catch (e) {
    if (e instanceof AuthError) return { error: "invalid" };
    throw e; // the successful sign-in redirect is thrown by Next and must pass through
  }
  return { error: null };
}
