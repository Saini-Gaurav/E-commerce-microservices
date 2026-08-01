CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT NOT NULL,
  rich_description  TEXT DEFAULT '',
  image             VARCHAR(500) DEFAULT '',

  -- A native Postgres array instead of a separate product_images join
  -- table. Trade-off: you can't efficiently query "find products
  -- containing image X" or attach metadata per-image this way - if you
  -- ever need that, normalize into its own table. For "just display a
  -- gallery on the product page," an array is simpler and avoids a JOIN
  -- on every product read, which is the far more common operation here.
  images            TEXT[] NOT NULL DEFAULT '{}',

  brand             VARCHAR(255) DEFAULT '',

  -- NUMERIC, not FLOAT/REAL. Floats use binary floating point, which
  -- cannot represent most decimal fractions exactly (0.1 + 0.2 !== 0.3) -
  -- fine for a science simulation, not fine for money. NUMERIC(10,2) is
  -- exact decimal storage: 8 digits before the point, 2 after.
  price             NUMERIC(10, 2) NOT NULL DEFAULT 0,

  category_id       UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,

  -- Carried over from the original Mongoose schema's min(0)/max(255).
  -- Worth questioning: an upper bound of exactly 255 looks like it was
  -- copied from an unrelated byte-range constraint rather than a real
  -- business rule ("we never stock more than 255 units of anything" is
  -- an odd thing to be true). Kept here for parity with existing data;
  -- flag this to whoever owns the product catalog before relying on it.
  count_in_stock    INTEGER NOT NULL DEFAULT 0 CHECK (count_in_stock BETWEEN 0 AND 255),

  rating            NUMERIC(2, 1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  num_reviews       INTEGER NOT NULL DEFAULT 0,
  is_featured       BOOLEAN NOT NULL DEFAULT false,

  ingredients       TEXT DEFAULT '',
  usage_notes       TEXT DEFAULT '',
  benefits          TEXT DEFAULT '',
  precautions       TEXT DEFAULT '',
  quantity          VARCHAR(100) DEFAULT '',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IMPORTANT and easy to forget: unlike some other databases, Postgres does
-- NOT automatically create an index on a foreign key column. Without this,
-- "get all products in category X" (the single most common product query
-- on an e-commerce site) does a full table scan, and worse, deleting a row
-- from categories has to full-scan products to check the RESTRICT.
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Supports the admin "featured products" section without a full scan.
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured) WHERE is_featured = true;