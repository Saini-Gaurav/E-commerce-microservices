import "dotenv/config";
import { createUser, findUserByEmail } from "../repositories/user.repository";
import { hashPassword } from "../utils/password.util";
import { pool } from "./db";

// Idempotent by design: safe to run this multiple times without piling up duplicate users, since we check findUserByEmail before each insert rather than just blindly INSERTing.
const USERS = [
  { name: "Priya Sharma",  email: "priya@test.com",  phone: "9111111111", roleCode: "CUSTOMER", role: "Customer" },
  { name: "Rahul Verma",   email: "rahul@test.com",  phone: "9222222222", roleCode: "CUSTOMER", role: "Customer" },
  { name: "Anita Desai",   email: "anita@test.com",  phone: "9333333333", roleCode: "ADMIN",    role: "Administrator" },
];

const SEED_PASSWORD = "Password123!"; // same for all seeded users - fine for local dev, never do this in a real seed script for a shared/staging environment

async function seed() {
  for (const u of USERS) {
    const existing = await findUserByEmail(u.email);
    if (existing) {
      console.log(`- skip ${u.email} (already exists)`);
      continue;
    }

    const passwordHash = await hashPassword(SEED_PASSWORD);
    await createUser({
      name: u.name,
      email: u.email,
      passwordHash,
      phone: u.phone,
      roleCode: u.roleCode,
      role: u.role,
    });
    console.log(`✓ created ${u.email} (${u.roleCode})`);
  }

  console.log(`\nAll seeded users share the password: ${SEED_PASSWORD}`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});