ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Widening the existing CHECK, not adding a new column - REFUNDED
-- becomes a fourth valid value alongside CREATED/PAID/FAILED. Postgres
-- doesn't let you ALTER a CHECK constraint directly - you drop the old
-- one and add a new one with the same name convention.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('CREATED', 'PAID', 'FAILED', 'REFUNDED'));