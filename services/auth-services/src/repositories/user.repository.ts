import { query } from "../config/db";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string;
  role_code: string; // e.g. 'ADMIN', 'CUSTOMER' — used for permission checks
  role: string; // e.g. 'Administrator' — human-readable, for display only
  street: string;
  apartment: string;
  zip: string;
  city: string;
  country: string;
  created_at: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  roleCode: string;
  role: string;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const result = await query<UserRow>(
    `INSERT INTO users (name, email, password_hash, phone, role_code, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.name,
      input.email,
      input.passwordHash,
      input.phone,
      input.roleCode,
      input.role,
    ]
  );
  return result.rows[0];
}

export async function findUserByEmail(
  email: string
): Promise<UserRow | undefined> {
  const result = await query<UserRow>(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0];
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const result = await query<UserRow>(`SELECT * FROM users WHERE id = $1`, [
    id,
  ]);
  return result.rows[0];
} 

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    passwordHash,
    userId,
  ]);
}

export async function updateUserProfile(
  userId: string,
  name: string,
  phone: string
): Promise<UserRow | null> {
  const result = await query<UserRow>(
    "UPDATE users SET name = $1, phone = $2, updated_at = now() WHERE id = $3 RETURNING *",
    [name, phone, userId]
  );
  return result.rows[0] ?? null;
}

export async function getUserCounts(): Promise<{
  total: number;
  admins: number;
  newLast30Days: number;
}> {
  const result = await query<{ total: string; admins: string; new_users: string }>(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE role_code = 'ADMIN') AS admins,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS new_users
     FROM users`
  );
  const row = result.rows[0];
  return {
    total: Number(row.total),
    admins: Number(row.admins),
    newLast30Days: Number(row.new_users),
  };
}