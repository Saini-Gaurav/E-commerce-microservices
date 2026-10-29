import { query } from "../config/db";

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_token_hash: string | null;
  created_at: Date;
}

export async function storeRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<RefreshTokenRow> {
  const result = await query<RefreshTokenRow>(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, tokenHash, expiresAt]
  );
  return result.rows[0];
}

export async function findActiveRefreshToken(
  tokenHash: string
): Promise<RefreshTokenRow | undefined> {
  const result = await query<RefreshTokenRow>(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > now()`,
    [tokenHash]
  );
  return result.rows[0];
}

export async function findRefreshTokenByHash(
  tokenHash: string
): Promise<RefreshTokenRow | undefined> {
  const result = await query<RefreshTokenRow>(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0];
}


export async function revokeRefreshToken(
  tokenHash: string,
  replacedByTokenHash?: string
): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now(),
         replaced_by_token_hash = $2
     WHERE token_hash = $1`,
    [tokenHash, replacedByTokenHash ?? null]
  );
}


export async function revokeAllRefreshTokensForUser(
  userId: string
): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}