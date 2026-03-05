const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

async function run() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Platform Admin";

  if (!email) {
    throw new Error("SEED_ADMIN_EMAIL is required");
  }

  if (!password || password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD is required and must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "admin",
      passwordHash
    },
    create: {
      email,
      name,
      role: "admin",
      passwordHash
    }
  });

  console.log(`Admin user ready: ${admin.email} (${admin.role})`);
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
