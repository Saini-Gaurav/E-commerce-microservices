-- Refresh tokens are stored HASHED, never in plain text.
-- Same principle as passwords: if this table ever leaks, an attacker
-- shouldn't be able to use the stored value directly as a working token.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- which user this refresh token belongs to
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- SHA-256 hash of the actual refresh token string (the raw value only
  -- ever exists in the user's cookie, never stored anywhere on our side)
  token_hash              TEXT NOT NULL UNIQUE,

  -- after this time, the token is dead even if never explicitly revoked
  expires_at              TIMESTAMPTZ NOT NULL,

  -- NULL = still active. Set when the user logs out, or when this token
  -- gets rotated (replaced by a newer one), or if we detect token theft.
  revoked_at              TIMESTAMPTZ,

  -- when a token is rotated, we record the hash of its replacement here.
  -- this lets us build a "chain" of tokens per login session, so if a
  -- REVOKED token is ever used again, we know something is wrong
  -- (someone replayed an old, already-rotated token) and can nuke the
  -- whole chain.
  replaced_by_token_hash  TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- We look up by token_hash on every refresh request — must be fast.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- We look up "all tokens for this user" on logout-everywhere.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);