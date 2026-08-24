import { query } from "../config/db";

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: Date;
}

export async function createContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<ContactMessageRow> {
  const result = await query<ContactMessageRow>(
    `INSERT INTO contact_messages (name, email, subject, message)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.name, input.email, input.subject, input.message]
  );
  return result.rows[0];
}

export async function listContactMessages(limit: number, offset: number): Promise<ContactMessageRow[]> {
  const result = await query<ContactMessageRow>(
    `SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

export async function countContactMessages(): Promise<number> {
  const result = await query<{ count: string }>("SELECT COUNT(*) FROM contact_messages");
  return Number(result.rows[0].count);
}