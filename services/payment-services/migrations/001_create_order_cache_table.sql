CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Payment-service's own local copy of "which order costs how much,"
-- filled in automatically by listening to order-service's ORDER_CREATED
-- event - same pattern as cart/order-service's product_cache, but this
-- one exists for a SECURITY reason, not just a performance one: it's
-- what makes it structurally impossible to trust a client-supplied
-- amount when creating a Razorpay order.
CREATE TABLE IF NOT EXISTS order_cache (
  order_id     UUID PRIMARY KEY,
  user_id      UUID NOT NULL,
  total_price  NUMERIC(10, 2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);