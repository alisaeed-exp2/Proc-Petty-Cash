// Runs before every release on Railway (see railway.json "preDeployCommand").
//   1. Creates / updates the database tables from prisma/schema.prisma (prisma db push).
//      It never drops data: a destructive schema change makes the deploy fail instead.
//   2. Creates the first admin (System Administrator) from ADMIN_EMAIL / ADMIN_NAME /
//      ADMIN_INITIAL_PASSWORD, only if that email does not exist yet. An existing
//      account is never touched, so changing your password later is safe.
const { execSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

function run(cmd) {
  console.log("> " + cmd);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  run("npx prisma db push --skip-generate");

  // One-time move to company-scoped data: records created before companies were introduced
  // go to the oldest company, and every existing user gets access to it.
  {
    const db = new PrismaClient();
    try {
      const first = await db.company.findFirst({ orderBy: { id: "asc" } });
      if (first) {
        const [f, a, r, l] = await Promise.all([
          db.funding.updateMany({ where: { companyId: null }, data: { companyId: first.id } }),
          db.allocation.updateMany({ where: { companyId: null }, data: { companyId: first.id } }),
          db.cashReturn.updateMany({ where: { companyId: null }, data: { companyId: first.id } }),
          db.ledgerEntry.updateMany({ where: { companyId: null }, data: { companyId: first.id } }),
        ]);
        const moved = f.count + a.count + r.count + l.count;
        if (moved) console.log("Assigned " + moved + " existing records to company " + first.code);
        if ((await db.userCompany.count()) === 0) {
          const users = await db.user.findMany({ select: { id: true } });
          if (users.length) {
            await db.userCompany.createMany({ data: users.map((u) => ({ userId: u.id, companyId: first.id })), skipDuplicates: true });
            console.log("Gave " + users.length + " existing users access to company " + first.code);
          }
        }
      }
    } finally {
      await db.$disconnect();
    }
  }

  // One-off promotion: set PROMOTE_TO_SYSTEM_ADMIN=<email> for a deploy, then remove it.
  // Equivalent to: UPDATE "User" SET role = 'SYSTEM_ADMIN' WHERE email = '<email>';
  const promote = (process.env.PROMOTE_TO_SYSTEM_ADMIN || "").trim().toLowerCase();
  if (promote) {
    const db = new PrismaClient();
    try {
      const res = await db.user.updateMany({ where: { email: promote }, data: { role: "SYSTEM_ADMIN" } });
      console.log(res.count ? "Promoted to SYSTEM_ADMIN: " + promote : "No user found to promote: " + promote);
    } finally {
      await db.$disconnect();
    }
  }

  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password) {
    console.log("ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD not set: skipping admin creation.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Until the admin has chosen their own password, force a change on next sign-in.
      const forced = await prisma.user.updateMany({
        where: { email, passwordChangedAt: null, mustChangePassword: false },
        data: { mustChangePassword: true },
      });
      console.log("Admin user already exists, leaving it unchanged: " + email + (forced.count ? " (password change required at next sign-in)" : ""));
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        name: process.env.ADMIN_NAME || "System Administrator",
        passwordHash,
        role: "SYSTEM_ADMIN",
        locale: "en",
        mustChangePassword: true,
      },
    });
    console.log("Created admin user: " + email);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
