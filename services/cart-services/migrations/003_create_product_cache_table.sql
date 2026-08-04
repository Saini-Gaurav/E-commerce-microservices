-- Cart-service's own small copy of "just enough" product info, kept up
-- to date by listening to Kafka instead of asking product-service live.
CREATE TABLE IF NOT EXISTS product_cache (
  id               UUID PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  price            NUMERIC(10, 2) NOT NULL,
  image            VARCHAR(500) DEFAULT '',
  count_in_stock   INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);