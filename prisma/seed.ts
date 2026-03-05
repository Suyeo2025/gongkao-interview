import "dotenv/config";
import crypto from "crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL || "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  let adminPassword = process.env.ADMIN_PASSWORD;
  let generated = false;

  if (!adminPassword) {
    adminPassword = crypto.randomBytes(16).toString("base64url");
    generated = true;
  }

  const hash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: { passwordHash: hash },
    create: {
      username: adminUsername,
      passwordHash: hash,
      role: "admin",
    },
  });

  console.log(`Admin user "${adminUsername}" seeded.`);
  if (generated) {
    console.log(`⚠️  未设置 ADMIN_PASSWORD，已生成随机密码: ${adminPassword}`);
    console.log(`   请妥善保存此密码，或设置 ADMIN_PASSWORD 环境变量后重新 seed。`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
