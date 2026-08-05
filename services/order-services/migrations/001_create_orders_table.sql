CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- No FK - users live in auth-service's database, a completely
  -- separate service. This is trusted from the verified JWT
  -- (req.user.userId), not enforced by Postgres. Same trade-off named
  -- back when we first designed this table, now actually built.
  user_id           UUID NOT NULL,

  shipping_address1 VARCHAR(255) NOT NULL,
  shipping_address2 VARCHAR(255) DEFAULT '',
  city              VARCHAR(255) NOT NULL,
  zip               VARCHAR(32) NOT NULL,
  country           VARCHAR(255) NOT NULL,
  phone             VARCHAR(32) NOT NULL,

  -- A real enum instead of the original schema's free-text status
  -- string - CHECK rejects anything not in this list at write time,
  -- rather than letting a typo like "Shiped" silently corrupt the data.
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),

  -- The sum of all order_items.line_total at creation time. Stored
  -- (not computed live via a join+SUM every read) because an order's
  -- total, like its prices, must never silently change later.
  total_price       NUMERIC(10, 2) NOT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Show me this user's order history" is the single most common query
-- this table will ever get - same FK-index lesson as products.category_id.
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);