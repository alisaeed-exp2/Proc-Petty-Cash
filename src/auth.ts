import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// A fixed hash to compare against when the email is unknown, so response time
// does not reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12 hours
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.active || !ok) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role, locale: user.locale };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.locale = user.locale;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "SYSTEM_ADMIN" | "GROUP_VP" | "MANAGER" | "CONTROLLER" | "AGENT";
      session.user.locale = token.locale as "en" | "ar";
      return session;
    },
  },
});
