ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);

-- A PARTIAL unique index (the WHERE clause) - only enforces uniqueness
-- when a key is actually present. Every order created before this
-- migration has idempotency_key = NULL, and a plain unique index would
-- treat multiple NULLs as a conflict, which isn't what we want here;
-- Postgres treats NULL as "not equal to itself" for uniqueness
-- purposes by default anyway, but being explicit with WHERE makes the
-- intent obvious rather than relying on that subtlety.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_idempotency
  ON orders(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;