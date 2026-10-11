// Runs before every release on Railway (see railway.json "preDeployCommand").
//   1. Creates / updates the database tables from prisma/schema.prisma (prisma db push).
//      It never drops data: a destructive schema change makes the deploy fail instead.
//   2. Creates the first admin (Procurement Manager) from ADMIN_EMAIL / ADMIN_NAME /
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
      console.log("Admin user already exists, leaving it unchanged: " + email);
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        name: process.env.ADMIN_NAME || "Procurement Manager",
        passwordHash,
        role: "MANAGER",
        locale: "en",
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
