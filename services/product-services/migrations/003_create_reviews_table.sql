CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,

  -- Snapshotted at review time, same reasoning as order_items snapshotting
  -- product_name - avoids a live call to auth-service just to display
  -- "Priya S." next to a review. If the person changes their name later,
  -- old reviews keep showing what it was at the time - a minor, acceptable
  -- trade-off for not needing a cross-service call on every review read.
  user_name   VARCHAR(255) NOT NULL,

  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One review per user per product - editing an existing review
  -- replaces it rather than letting someone spam five 1-star reviews
  -- on the same item.
  UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);