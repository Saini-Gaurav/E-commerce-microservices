-- Identical purpose and shape to cart-service's product_cache: this
-- service's own local, Kafka-fed copy of "just enough" product info to
-- validate an order and snapshot a price, without ever calling
-- product-service directly.
CREATE TABLE IF NOT EXISTS product_cache (
  id               UUID PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  price            NUMERIC(10, 2) NOT NULL,
  count_in_stock   INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);