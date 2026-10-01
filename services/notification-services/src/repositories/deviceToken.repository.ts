import { query } from "../config/db";

export async function registerToken(userId: string, token: string): Promise<void> {
  await query(
    `INSERT INTO device_tokens (user_id, token) VALUES ($1, $2)
     ON CONFLICT (user_id, token) DO NOTHING`,
    [userId, token]
  );
}

export async function findTokensByUserId(userId: string): Promise<string[]> {
  const result = await query<{ token: string }>(
    "SELECT token FROM device_tokens WHERE user_id = $1",
    [userId]
  );
  return result.rows.map((r) => r.token);
}

/**
 * Called after a send attempt reports the token is permanently dead -
 * keeps this table from silently accumulating tokens for devices that
 * will never receive anything again.
 */
export async function removeToken(token: string): Promise<void> {
  await query("DELETE FROM device_tokens WHERE token = $1", [token]);
}