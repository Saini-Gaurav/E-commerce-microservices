CREATE TABLE IF NOT EXISTS cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES carts(user_id) ON DELETE CASCADE,

  -- No FK to a products table - product-service owns that table, in a
  -- completely separate database. This id is only validated at write
  -- time via an HTTP call to product-service (see cart.service.ts),
  -- not enforced by Postgres. Same trade-off as order_items.product_id
  -- will be once we build order-service.
  product_id  UUID NOT NULL,

  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One row per product per user's cart - "add to cart" on a product
  -- already in there should increase quantity, never create a duplicate row.
  UNIQUE (user_id, product_id)
);

-- Explicit FK index, same lesson as products.category_id: Postgres does
-- not create this automatically, and "get my cart's items" is the
-- single most common query this table will ever see.
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);