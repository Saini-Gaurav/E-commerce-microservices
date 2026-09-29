-- Populated by listening to ORDER_CREATED (order-events already
-- consumed by this service for stock decrement) - a lightweight local
-- record of "this user ordered this product," used ONLY to gate who's
-- allowed to leave a review. Explicitly NOT proof of payment or
-- delivery - see the design note on what "verified" means here.
CREATE TABLE IF NOT EXISTS product_purchases (
  user_id     UUID NOT NULL,
  product_id  UUID NOT NULL,
  ordered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);