// Development seed: three users (one per role), two companies, a few projects.
// Run with: npm run db:seed   (requires DATABASE_URL and SEED_PASSWORD)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set SEED_PASSWORD (min 8 chars) before seeding.");
  const passwordHash = await bcrypt.hash(password, 12);

  const users = [
    { email: "manager@akcc.local", name: "Procurement Manager", role: "MANAGER" as const },
    { email: "controller@akcc.local", name: "Expense Controller", role: "CONTROLLER" as const },
    { email: "agent1@akcc.local", name: "Purchase Agent 1", role: "AGENT" as const },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash } });
  }

  const companies = [
    { code: "C01", nameEn: "Sample Company One", nameAr: "الشركة النموذجية الأولى" },
    { code: "C02", nameEn: "Sample Company Two", nameAr: "الشركة النموذجية الثانية" },
  ];
  for (const c of companies) {
    const company = await prisma.company.upsert({ where: { code: c.code }, update: {}, create: c });
    await prisma.project.upsert({
      where: { companyId_code: { companyId: company.id, code: "P01" } },
      update: {},
      create: { companyId: company.id, code: "P01", nameEn: "Sample Project", nameAr: "مشروع نموذجي" },
    });
  }
  console.log("Seeded users, companies and projects.");
}

main().finally(() => prisma.$disconnect());
