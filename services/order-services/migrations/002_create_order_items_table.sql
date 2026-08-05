CREATE TABLE IF NOT EXISTS order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- No FK - product-service's table, separate database. Validated at
  -- write time against this service's own local product_cache
  -- (see migration 003), not by Postgres.
  product_id    UUID NOT NULL,

  -- SNAPSHOTTED at order time, on purpose - this is the whole point of
  -- this table being separate from a live join. If the product's real
  -- name/price changes next week, THIS row must not change - it's a
  -- historical record of what was actually charged, not a live view.
  product_name  VARCHAR(255) NOT NULL,
  unit_price    NUMERIC(10, 2) NOT NULL,

  quantity      INTEGER NOT NULL CHECK (quantity > 0),

  -- Also stored, not computed on every read - unit_price * quantity,
  -- frozen at insert time for the same "never silently changes" reason.
  line_total    NUMERIC(10, 2) NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);