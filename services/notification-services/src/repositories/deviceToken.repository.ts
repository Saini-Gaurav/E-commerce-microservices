import { query } from "../config/db";

/**
 * A token identifies a browser, not a person - if user A logs out and
 * user B logs in on the same browser, the same token arrives for B. The
 * CTE detaches it from any previous user in the same statement, otherwise
 * A's order notifications would keep popping up on B's screen.
 */
export async function registerToken(userId: string, token: string): Promise<void> {
  await query(
    `WITH detached AS (
       DELETE FROM device_tokens WHERE token = $2 AND user_id <> $1
     )
     INSERT INTO device_tokens (user_id, token) VALUES ($1, $2)
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