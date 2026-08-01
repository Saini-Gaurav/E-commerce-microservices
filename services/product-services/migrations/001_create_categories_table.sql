CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  icon        VARCHAR(255) DEFAULT '',
  color       VARCHAR(50)  DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Category names weren't unique in the old Mongoose schema, but two
-- categories both called "Skincare" is almost certainly a data-entry bug,
-- not a real business case. Enforcing it here catches that at write time
-- instead of quietly building a confusing dropdown for admins later.
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_idx ON categories (LOWER(name));