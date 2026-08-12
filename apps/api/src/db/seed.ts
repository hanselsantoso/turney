import argon2 from "argon2";
import { db, sql } from "./client";
import { users } from "./schema";

const seedUsers = [
  { email: "admin@turney.id", displayName: "Admin", isAdmin: true, playerCode: "ADM-1001" },
  { email: "judge@turney.id", displayName: "Multi", isAdmin: false, playerCode: "MUL-1002" },
  { email: "gai@turney.id", displayName: "Gai", isAdmin: false, playerCode: "GAI-1003" },
  { email: "ekusu@turney.id", displayName: "Ekusu", isAdmin: false, playerCode: "EKU-1004" },
];

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? "turney-local-dev";
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  for (const u of seedUsers) {
    await db.insert(users).values({ ...u, passwordHash }).onConflictDoNothing({ target: users.email });
  }
  console.log(`Seeded ${seedUsers.length} users (password: ${password})`);
  await sql.end();
}

main();
