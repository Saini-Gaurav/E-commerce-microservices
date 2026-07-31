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

/**
 * Back to a single INSERT ... RETURNING *, no follow-up query needed —
 * unlike the roles-table version, role_code/role live directly on this
 * row, so RETURNING * already gives us everything.
 */
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