import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: { name: "Admin", email: adminEmail, passwordHash, role: "Administrator" },
    update: {},
  });
  console.log(`Seeded admin user: ${adminEmail}`);

  for (const name of ["Administrator", "Resource Manager", "Standard User", "Stealth User"]) {
    await prisma.role.upsert({ where: { name }, create: { name, isAdmin: name === "Administrator" }, update: {} });
  }

  const defaultTeam = await prisma.team.upsert({
    where: { name: "Default" },
    create: { name: "Default", trackingSettings: { create: {} } },
    update: {},
  });
  console.log(`Seeded team: ${defaultTeam.name}`);

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
