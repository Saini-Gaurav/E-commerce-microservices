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

/**
 * Saves a new refresh token (already hashed by the caller — this
 * repository never sees the raw token, only its hash).
 */
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

/**
 * Finds a refresh token by its hash, but ONLY if it's still valid:
 * not revoked, and not past its expiry date. This single query is what
 * the "refresh access token" endpoint calls to decide whether to trust
 * the refresh token cookie a user sent us.
 */
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

/**
 * Finds a token by hash regardless of whether it's revoked/expired.
 * Used for THEFT DETECTION: if a client presents a token hash that
 * exists in the table but is already revoked, that means someone is
 * replaying an old, already-rotated-away token — a red flag that the
 * refresh token was stolen at some point.
 */
export async function findRefreshTokenByHash(
  tokenHash: string
): Promise<RefreshTokenRow | undefined> {
  const result = await query<RefreshTokenRow>(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0];
}

/**
 * Marks a token as revoked, and (optionally) records which token
 * replaced it — this is what happens on every rotation: the old
 * refresh token is revoked and linked forward to the new one.
 */
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

/**
 * Revokes every active refresh token for a user in one shot.
 * Used for "log out of all devices", and also as the response to
 * detected token theft (kill every session for this user just in case).
 */
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