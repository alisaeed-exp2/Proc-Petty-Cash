import type { DefaultSession } from "next-auth";

type AppRole = "SYSTEM_ADMIN" | "GROUP_VP" | "MANAGER" | "CONTROLLER" | "AGENT";
type AppLocale = "en" | "ar";

declare module "next-auth" {
  interface User {
    role: AppRole;
    locale: AppLocale;
  }
  interface Session {
    user: { id: string; role: AppRole; locale: AppLocale } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: AppRole;
    locale?: AppLocale;
  }
}
